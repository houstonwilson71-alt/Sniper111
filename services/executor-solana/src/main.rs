use std::env;
use std::time::Duration;
use anyhow::{anyhow, Context, Result};
use redis::{aio::ConnectionManager, AsyncCommands, RedisResult};
use serde_json::{json, Value};
use tokio::time::timeout;
use tracing::{info, warn, error};

use common::{BuySignal, SellSignal, Trade, TradeSide, Chain, TradeStatus, CHANNELS};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("info,executor_solana=debug"))
        .init();

    let live = env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true";
    let solana_key = env::var("SOLANA_PRIVATE_KEY").ok();
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let jito_url = env::var("JITO_BLOCK_ENGINE_URL").unwrap_or_default();
    let jupiter_api = env::var("JUPITER_API_URL").unwrap_or_else(|| "https://quote-api.jup.ag/v6".to_string());

    if live && solana_key.is_none() {
        error!("LIVE_TRADING_ENABLED=true but SOLANA_PRIVATE_KEY is not set. Refusing to start.");
        return Err(anyhow!("missing SOLANA_PRIVATE_KEY in live mode"));
    }

    info!("Solana executor starting... live={} jupiter={}", live, jupiter_api);

    let redis = redis::Client::open(redis_url)?;
    let mut con = ConnectionManager::new(redis).await?;
    let mut pub_con = con.clone();

    let mut sub = con.into_pubsub();
    sub.subscribe(CHANNELS.BUY_SIGNAL).await?;
    sub.subscribe(CHANNELS.SELL_SIGNAL).await?;

    let mut stream = sub.on_message();

    while let Some(msg) = stream.next().await {
        let payload: Value = match serde_json::from_str(&msg.get_payload::<String>().unwrap_or_default()) {
            Ok(v) => v,
            Err(e) => { error!("bad event payload: {}", e); continue; }
        };
        let channel = payload["channel"].as_str().unwrap_or("");
        match channel {
            CHANNELS.BUY_SIGNAL => {
                let signal: BuySignal = match serde_json::from_value(payload["payload"].clone()) {
                    Ok(s) => s,
                    Err(e) => { error!("bad buy signal: {}", e); continue; }
                };
                if let Err(e) = execute_buy(signal, live, &jupiter_api, &jito_url, solana_key.as_deref(), &mut pub_con).await {
                    error!("buy execution failed: {}", e);
                }
            }
            CHANNELS.SELL_SIGNAL => {
                let signal: SellSignal = match serde_json::from_value(payload["payload"].clone()) {
                    Ok(s) => s,
                    Err(e) => { error!("bad sell signal: {}", e); continue; }
                };
                if let Err(e) = execute_sell(signal, live, &jupiter_api, &jito_url, solana_key.as_deref(), &mut pub_con).await {
                    error!("sell execution failed: {}", e);
                }
            }
            _ => {}
        }
    }

    Ok(())
}

async fn execute_buy(
    signal: BuySignal,
    live: bool,
    jupiter_api: &str,
    _jito_url: &str,
    key: Option<&str>,
    con: &mut ConnectionManager,
) -> Result<()> {
    info!("buy signal: {} {} ${}", signal.token.chain, signal.token.symbol, signal.amount_usd);

    if !live {
        info!("DRY interlock: LIVE_TRADING_ENABLED is false; not submitting transaction.");
        return Ok(());
    }

    let _key = key.context("no Solana key")?;

    // Real implementation:
    // 1. Get Jupiter quote for WSOL -> token
    // 2. Build swap transaction via Jupiter /swap-instruction or /swap
    // 3. Sign with keypair
    // 4. Optionally wrap in Jito bundle via jito-json-rpc-client
    // 5. Send and confirm
    // 6. Publish TRADE_UPDATE event

    let trade = Trade {
        id: format!("sol-buy-{}", chrono::Utc::now().timestamp_millis()),
        token_id: signal.token.id.clone(),
        token_symbol: signal.token.symbol.clone(),
        token_address: signal.token.address.clone(),
        chain: Chain::Solana,
        position_id: signal.token.id.clone(),
        side: TradeSide::Buy,
        amount_usd: signal.amount_usd,
        price_usd: signal.token.price_usd,
        tx_hash: "pending".to_string(),
        status: TradeStatus::Pending,
        fees_usd: 0.0,
        pnl_usd: None,
        pnl_pct: None,
        executed_at: chrono::Utc::now().to_rfc3339(),
        sell_reason: None,
    };
    publish_trade(con, trade).await?;

    warn!("TODO: wire real Jupiter + Jito bundle submission");
    Ok(())
}

async fn execute_sell(
    signal: SellSignal,
    live: bool,
    jupiter_api: &str,
    _jito_url: &str,
    key: Option<&str>,
    con: &mut ConnectionManager,
) -> Result<()> {
    info!("sell signal: {} reason={} sell_pct={}", signal.position.token_symbol, signal.reason, signal.sell_pct);

    if !live {
        info!("DRY interlock: LIVE_TRADING_ENABLED is false; not submitting transaction.");
        return Ok(());
    }

    let _key = key.context("no Solana key")?;

    let trade = Trade {
        id: format!("sol-sell-{}", chrono::Utc::now().timestamp_millis()),
        token_id: signal.position.token_id.clone(),
        token_symbol: signal.position.token_symbol.clone(),
        token_address: signal.position.token_address.clone(),
        chain: Chain::Solana,
        position_id: signal.position.id.clone(),
        side: TradeSide::Sell,
        amount_usd: signal.position.size_usd * signal.sell_pct / 100.0,
        price_usd: signal.target_price_usd.unwrap_or(signal.position.current_price_usd),
        tx_hash: "pending".to_string(),
        status: TradeStatus::Pending,
        fees_usd: 0.0,
        pnl_usd: None,
        pnl_pct: None,
        executed_at: chrono::Utc::now().to_rfc3339(),
        sell_reason: Some(signal.reason.to_string()),
    };
    publish_trade(con, trade).await?;

    warn!("TODO: wire real Jupiter + Jito bundle submission");
    Ok(())
}

async fn publish_trade(con: &mut ConnectionManager, trade: Trade) -> Result<()> {
    let event = json!({
        "channel": CHANNELS.TRADE_UPDATE,
        "id": format!("trade-{}", trade.id),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "payload": trade,
    });
    let payload = serde_json::to_string(&event)?;
    con.publish(CHANNELS.TRADE_UPDATE, payload).await?;
    Ok(())
}
