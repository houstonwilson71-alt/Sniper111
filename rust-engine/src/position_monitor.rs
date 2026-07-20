use std::collections::HashMap;
use std::time::Duration;
use anyhow::Result;
use futures::StreamExt;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::json;
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{info, warn, error};

use crate::config::EngineConfig;
use crate::types::{Command, EngineEvent, Position};

pub async fn run(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut cmd_rx: mpsc::Receiver<Command>,
) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let mut pub_con = ConnectionManager::new(redis_client.clone()).await?;
    let mut sub = redis_client.get_async_pubsub().await?;
    sub.subscribe("trades:new").await?;
    let mut trade_stream = sub.on_message();

    let mut positions: HashMap<String, Position> = HashMap::new();
    let mut price_cache: HashMap<String, f64> = HashMap::new();
    let mut ticker = interval(Duration::from_secs(5));

    loop {
        tokio::select! {
            Some(cmd) = cmd_rx.recv() => {
                match cmd {
                    Command::Start => info!("Position monitor started"),
                    Command::Stop => info!("Position monitor stopped"),
                    Command::EmergencyStop(reason) => {
                        warn!("Emergency stop triggered: {}", reason);
                        for (id, pos) in positions.iter_mut() {
                            emit_sell(&cfg, id, pos, "emergency", 100.0, &event_tx, &mut pub_con).await?;
                        }
                    }
                    _ => {}
                }
            }
            Some(msg) = trade_stream.next() => {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&msg.get_payload::<String>().unwrap_or_default()) {
                    if let Ok(trade) = serde_json::from_value::<crate::types::Trade>(payload["payload"].clone()) {
                        if trade.side == "buy" && trade.status == "confirmed" {
                            if let Ok(Some(pos)) = open_position_from_trade(&trade).await {
                                positions.insert(pos.id.clone(), pos.clone());
                                persist_position(&mut pub_con, &pos).await?;
                                event_tx.send(EngineEvent::PositionUpdate(pos)).await.ok();
                            }
                        }
                    }
                }
            }
            _ = ticker.tick() => {
                // Update prices (mock: in production fetch from DEX/RPC)
                for pos in positions.values_mut() {
                    let new_price = fetch_price(&cfg, pos).await.unwrap_or(pos.current_price_usd);
                    pos.current_price_usd = new_price;
                    if new_price > pos.peak_price_usd {
                        pos.peak_price_usd = new_price;
                    }
                    pos.unrealised_pnl_pct = (new_price - pos.entry_price_usd) / pos.entry_price_usd * 100.0;
                    pos.unrealised_pnl_usd = pos.size_usd * pos.unrealised_pnl_pct / 100.0;

                    evaluate_exits(&cfg, pos, &event_tx, &mut pub_con).await?;
                    persist_position(&mut pub_con, pos).await?;
                    event_tx.send(EngineEvent::PositionUpdate(pos.clone())).await.ok();
                }
                positions.retain(|_, pos| pos.status == "open");
            }
        }
    }
}

async fn evaluate_exits(
    cfg: &EngineConfig,
    pos: &mut Position,
    event_tx: &mpsc::Sender<EngineEvent>,
    con: &mut ConnectionManager,
) -> Result<()> {
    let pct = pos.unrealised_pnl_pct;

    // TP1
    if !pos.tp1_hit && pct >= cfg.tp1_pct {
        pos.tp1_hit = true;
        pos.trailing_stop_active = true;
        pos.stop_loss_price = pos.peak_price_usd * (1.0 - cfg.trailing_stop_pct / 100.0);
        emit_sell(cfg, "", pos, "tp1", cfg.tp1_sell_pct, event_tx, con).await?;
    }

    // Trailing stop
    if pos.trailing_stop_active {
        let new_stop = pos.peak_price_usd * (1.0 - cfg.trailing_stop_pct / 100.0);
        if pos.stop_loss_price < new_stop {
            pos.stop_loss_price = new_stop;
        }
        if pos.current_price_usd <= pos.stop_loss_price {
            emit_sell(cfg, "", pos, "trailing_stop", 100.0, event_tx, con).await?;
        }
    }

    // Time exit
    let opened = chrono::DateTime::parse_from_rfc3339(&pos.opened_at)?;
    let elapsed = chrono::Utc::now().signed_duration_since(opened);
    if elapsed.num_minutes() >= cfg.time_exit_minutes as i64 && pct < cfg.time_exit_min_profit_pct {
        emit_sell(cfg, "", pos, "time_exit", 100.0, event_tx, con).await?;
    }

    Ok(())
}

async fn emit_sell(
    cfg: &EngineConfig,
    _id: &str,
    pos: &mut Position,
    reason: &str,
    sell_pct: f64,
    event_tx: &mpsc::Sender<EngineEvent>,
    con: &mut ConnectionManager,
) -> Result<()> {
    pos.status = "closed".to_string();
    pos.closed_at = Some(chrono::Utc::now().to_rfc3339());

    let event = EngineEvent::SellSignal {
        position: pos.clone(),
        reason: reason.to_string(),
        sell_pct,
        target_price_usd: Some(pos.current_price_usd),
    };
    let channel = if pos.chain == "solana" { "sell:solana" } else { "sell:bsc" };
    let wrapped = json!({
        "channel": channel,
        "id": format!("{}-{}", channel, chrono::Utc::now().timestamp_millis()),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "payload": event,
    });
    let _: () = con.publish(channel, serde_json::to_string(&wrapped)?).await?;
    event_tx.send(event).await.ok();
    persist_position(con, pos).await?;
    Ok(())
}

async fn persist_position(con: &mut ConnectionManager, pos: &Position) -> Result<()> {
    let key = format!("position:{}", pos.id);
    let value = serde_json::to_string(pos)?;
    let _: () = con.set_ex(key, value, 86400_u64).await?;
    Ok(())
}

async fn open_position_from_trade(trade: &crate::types::Trade) -> Result<Option<Position>> {
    if trade.side != "buy" {
        return Ok(None);
    }
    Ok(Some(Position {
        id: format!("pos-{}-{}", trade.chain, uuid::Uuid::new_v4()),
        token_id: trade.token_id.clone(),
        token_symbol: trade.token_symbol.clone(),
        token_address: "".to_string(), // populated from token lookup in production
        chain: trade.chain.clone(),
        entry_price_usd: trade.price_usd,
        current_price_usd: trade.price_usd,
        peak_price_usd: trade.price_usd,
        size_usd: trade.amount_usd,
        status: "open".to_string(),
        tp1_hit: false,
        trailing_stop_active: false,
        stop_loss_price: 0.0,
        unrealised_pnl_usd: 0.0,
        unrealised_pnl_pct: 0.0,
        opened_at: chrono::Utc::now().to_rfc3339(),
        closed_at: None,
    }))
}

async fn fetch_price(cfg: &EngineConfig, pos: &Position) -> Option<f64> {
    if pos.token_address.is_empty() {
        return None;
    }
    // In production: query the DEX pair reserves or a price oracle.
    // Here we return a small random drift from the entry price for simulation purposes.
    Some(pos.entry_price_usd * (1.0 + (chrono::Utc::now().timestamp() % 10) as f64 / 100.0))
}
