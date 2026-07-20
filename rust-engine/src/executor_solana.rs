use std::str::FromStr;
use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::{json, Value};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::instruction::Instruction;
use solana_sdk::native_token::LAMPORTS_PER_SOL;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::transaction::Transaction;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

use crate::config::EngineConfig;
use crate::types::{EngineEvent, Position, Trade, TradeStatus};

pub async fn run(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut cmd_rx: mpsc::Receiver<crate::types::Command>,
) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let con = ConnectionManager::new(redis_client).await?;
    let mut pub_con = con.clone();
    let mut sub = con.into_pubsub();
    sub.subscribe("buy:solana").await?;
    sub.subscribe("sell:solana").await?;
    let mut stream = sub.on_message();

    let keypair = cfg.solana_private_key.as_ref().map(|k| parse_keypair(k));

    loop {
        tokio::select! {
            Some(cmd) = cmd_rx.recv() => {
                handle_command(cmd, &cfg, &mut pub_con, &event_tx).await?;
            }
            Some(msg) = stream.next() => {
                let payload: Value = serde_json::from_str(&msg.get_payload::<String>().unwrap_or_default()).unwrap_or_default();
                match payload["channel"].as_str().unwrap_or("") {
                    "buy:solana" => {
                        let signal: crate::types::EngineEvent = serde_json::from_value(payload["payload"].clone()).unwrap();
                        if let crate::types::EngineEvent::BuySignal { token, amount_usd, slippage_pct, jito_tip_lamports } = signal {
                            if let Err(e) = execute_buy(&cfg, &token, amount_usd, slippage_pct, jito_tip_lamports, keypair.as_ref(), &mut pub_con, &event_tx).await {
                                error!("Solana buy failed: {}", e);
                            }
                        }
                    }
                    "sell:solana" => {
                        let signal: crate::types::EngineEvent = serde_json::from_value(payload["payload"].clone()).unwrap();
                        if let crate::types::EngineEvent::SellSignal { position, reason, sell_pct, target_price_usd } = signal {
                            if let Err(e) = execute_sell(&cfg, &position, &reason, sell_pct, target_price_usd, keypair.as_ref(), &mut pub_con, &event_tx).await {
                                error!("Solana sell failed: {}", e);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

async fn handle_command(
    cmd: crate::types::Command,
    cfg: &EngineConfig,
    _con: &mut ConnectionManager,
    _event_tx: &mpsc::Sender<EngineEvent>,
) -> Result<()> {
    match cmd {
        crate::types::Command::UpdateConfig(_) => {}
        crate::types::Command::Start => info!("Solana executor started"),
        crate::types::Command::Stop => info!("Solana executor stopped"),
        crate::types::Command::EmergencyStop(reason) => warn!("Emergency stop: {}", reason),
        crate::types::Command::ResetEmergency => info!("Emergency reset"),
    }
    Ok(())
}

fn parse_keypair(s: &str) -> Keypair {
    Keypair::from_base58_string(s)
}

async fn execute_buy(
    cfg: &EngineConfig,
    token: &crate::types::Token,
    amount_usd: f64,
    slippage_pct: f64,
    jito_tip_lamports: u64,
    keypair: Option<&Result<Keypair, String>>,
    con: &mut ConnectionManager,
    event_tx: &mpsc::Sender<EngineEvent>,
) -> Result<()> {
    info!(
        "Solana BUY {} {} amount=${} slippage={}% jito_tip={}",
        token.symbol, token.address, amount_usd, slippage_pct, jito_tip_lamports
    );

    if !cfg.live_trading_enabled {
        info!("DRY interlock: LIVE_TRADING_ENABLED=false; skipping real transaction");
        let trade = build_trade(token, "buy", amount_usd, None, "dry-run");
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
        return Ok(());
    }

    let kp = keypair.context("no keypair")?.as_ref().map_err(|e| anyhow!("{}", e))?;
    let client = reqwest::Client::new();

    // 1. Jupiter quote: WSOL -> token
    let quote_url = format!(
        "{}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint={}&amount={}&slippageBps={}",
        cfg.jupiter_api_url,
        token.address,
        (amount_usd / 150.0 * LAMPORTS_PER_SOL as f64) as u64, // rough SOL amount
        (slippage_pct * 100.0) as u64
    );
    let quote: Value = client.get(&quote_url).send().await?.json().await?;

    // 2. Jupiter swap transaction
    let swap_body = json!({
        "quoteResponse": quote,
        "userPublicKey": kp.pubkey().to_string(),
        "wrapAndUnwrapSol": true,
        "priorityFeeLamports": jito_tip_lamports,
    });
    let swap: Value = client
        .post(format!("{}/swap", cfg.jupiter_api_url))
        .json(&swap_body)
        .send()
        .await?
        .json()
        .await?;

    let tx_b64 = swap["swapTransaction"].as_str().context("missing swapTransaction")?;
    let tx_bytes = BASE64.decode(tx_b64)?;
    let mut tx: Transaction = bincode::deserialize(&tx_bytes)?;
    tx.sign(&[kp], tx.message.recent_blockhash);

    // 3. Optionally wrap in Jito bundle
    if let Some(jito_url) = &cfg.jito_block_engine_url {
        let bundle = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendBundle",
            "params": [[BASE64.encode(tx.serialize())], { "tip": jito_tip_lamports }]
        });
        let res: Value = client
            .post(jito_url)
            .json(&bundle)
            .send()
            .await?
            .json()
            .await?;
        info!("Jito bundle response: {:?}", res);
        let bundle_id = res["result"].as_str().unwrap_or("unknown").to_string();
        let trade = build_trade(token, "buy", amount_usd, Some(bundle_id.clone()), "confirmed");
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
    } else {
        // Direct RPC send
        let rpc_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [BASE64.encode(tx.serialize()), { "encoding": "base64", "commitment": "confirmed" }]
        });
        let res: Value = client.post(&cfg.solana_rpc_url).json(&rpc_body).send().await?.json().await?;
        let tx_hash = res["result"].as_str().unwrap_or("unknown").to_string();
        info!("Solana tx sent: {}", tx_hash);
        let trade = build_trade(token, "buy", amount_usd, Some(tx_hash), "confirmed");
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
    }

    // 4. Open a position for the monitor
    let position = Position {
        id: format!("pos-sol-{}", uuid::Uuid::new_v4()),
        token_id: token.id.clone(),
        token_symbol: token.symbol.clone(),
        token_address: token.address.clone(),
        chain: "solana".to_string(),
        entry_price_usd: token.price_usd,
        current_price_usd: token.price_usd,
        peak_price_usd: token.price_usd,
        size_usd: amount_usd,
        status: "open".to_string(),
        tp1_hit: false,
        trailing_stop_active: false,
        stop_loss_price: 0.0,
        unrealised_pnl_usd: 0.0,
        unrealised_pnl_pct: 0.0,
        opened_at: chrono::Utc::now().to_rfc3339(),
        closed_at: None,
    };
    event_tx.send(EngineEvent::PositionUpdate(position)).await.ok();

    Ok(())
}

async fn execute_sell(
    cfg: &EngineConfig,
    position: &Position,
    reason: &str,
    sell_pct: f64,
    target_price_usd: Option<f64>,
    keypair: Option<&Result<Keypair, String>>,
    con: &mut ConnectionManager,
    event_tx: &mpsc::Sender<EngineEvent>,
) -> Result<()> {
    info!(
        "Solana SELL {} reason={} sell_pct={}% target=${:?}",
        position.token_symbol, reason, sell_pct, target_price_usd
    );

    if !cfg.live_trading_enabled {
        info!("DRY interlock: skipping real sell");
        let trade = build_sell_trade(position, sell_pct, reason, None);
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
        return Ok(());
    }

    let kp = keypair.context("no keypair")?.as_ref().map_err(|e| anyhow!("{}", e))?;
    let client = reqwest::Client::new();

    // Sell token -> WSOL
    let amount = (position.size_usd * sell_pct / 100.0 / 150.0 * LAMPORTS_PER_SOL as f64) as u64;
    let quote_url = format!(
        "{}/quote?inputMint={}&outputMint=So11111111111111111111111111111111111111112&amount={}&slippageBps={}",
        cfg.jupiter_api_url, position.token_address, amount, (cfg.slippage_pct * 100.0) as u64
    );
    let quote: Value = client.get(&quote_url).send().await?.json().await?;
    let swap_body = json!({
        "quoteResponse": quote,
        "userPublicKey": kp.pubkey().to_string(),
        "wrapAndUnwrapSol": true,
    });
    let swap: Value = client
        .post(format!("{}/swap", cfg.jupiter_api_url))
        .json(&swap_body)
        .send()
        .await?
        .json()
        .await?;
    let tx_b64 = swap["swapTransaction"].as_str().context("missing swapTransaction")?;
    let tx_bytes = BASE64.decode(tx_b64)?;
    let mut tx: Transaction = bincode::deserialize(&tx_bytes)?;
    tx.sign(&[kp], tx.message.recent_blockhash);

    let rpc_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendTransaction",
        "params": [BASE64.encode(tx.serialize()), { "encoding": "base64", "commitment": "confirmed" }]
    });
    let res: Value = client.post(&cfg.solana_rpc_url).json(&rpc_body).send().await?.json().await?;
    let tx_hash = res["result"].as_str().unwrap_or("unknown").to_string();
    info!("Solana sell tx: {}", tx_hash);

    let trade = build_sell_trade(position, sell_pct, reason, Some(tx_hash));
    publish_trade(con, &trade).await?;
    event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();

    Ok(())
}

fn build_trade(token: &crate::types::Token, side: &str, amount_usd: f64, tx_hash: Option<String>, status: &str) -> Trade {
    Trade {
        id: format!("sol-{}-{}", side, chrono::Utc::now().timestamp_millis()),
        token_id: token.id.clone(),
        token_symbol: token.symbol.clone(),
        chain: "solana".to_string(),
        side: side.to_string(),
        amount_usd,
        price_usd: token.price_usd,
        tx_hash: tx_hash.unwrap_or_else(|| "pending".to_string()),
        status: status.to_string(),
        fees_usd: 0.0,
        pnl_usd: None,
        pnl_pct: None,
        executed_at: chrono::Utc::now().to_rfc3339(),
        sell_reason: None,
    }
}

fn build_sell_trade(position: &Position, sell_pct: f64, reason: &str, tx_hash: Option<String>) -> Trade {
    Trade {
        id: format!("sol-sell-{}", chrono::Utc::now().timestamp_millis()),
        token_id: position.token_id.clone(),
        token_symbol: position.token_symbol.clone(),
        chain: "solana".to_string(),
        side: "sell".to_string(),
        amount_usd: position.size_usd * sell_pct / 100.0,
        price_usd: position.current_price_usd,
        tx_hash: tx_hash.unwrap_or_else(|| "pending".to_string()),
        status: "confirmed".to_string(),
        fees_usd: 0.0,
        pnl_usd: Some(position.unrealised_pnl_usd * sell_pct / 100.0),
        pnl_pct: Some(position.unrealised_pnl_pct * sell_pct / 100.0),
        executed_at: chrono::Utc::now().to_rfc3339(),
        sell_reason: Some(reason.to_string()),
    }
}

async fn publish_trade(con: &mut ConnectionManager, trade: &Trade) -> Result<()> {
    let event = json!({
        "channel": "trades:new",
        "id": format!("trade-{}", trade.id),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "payload": trade,
    });
    con.publish("trades:new", serde_json::to_string(&event)?).await?;
    Ok(())
}
