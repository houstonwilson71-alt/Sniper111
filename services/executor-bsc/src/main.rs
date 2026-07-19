use std::env;
use anyhow::{anyhow, Context, Result};
use ethers::prelude::*;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::{json, Value};
use tracing::{info, warn, error};

use common::{BuySignal, SellSignal, Trade, TradeSide, Chain, TradeStatus, CHANNELS};

const PANCAKE_ROUTER_V2: &str = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB: &str = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("info,executor_bsc=debug"))
        .init();

    let live = env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true";
    let bsc_key = env::var("BSC_PRIVATE_KEY").ok();
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let bsc_rpc = env::var("BSC_RPC_URL").unwrap_or_else(|| "https://bsc-dataseed.binance.org/".to_string());
    let bloxroute = env::var("BLOXROUTE_AUTH_HEADER").ok();

    if live && bsc_key.is_none() {
        error!("LIVE_TRADING_ENABLED=true but BSC_PRIVATE_KEY is not set. Refusing to start.");
        return Err(anyhow!("missing BSC_PRIVATE_KEY in live mode"));
    }

    info!("BSC executor starting... live={} rpc={}", live, bsc_rpc);

    let redis = redis::Client::open(redis_url)?;
    let con = ConnectionManager::new(redis).await?;
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
                if let Err(e) = execute_buy(signal, live, &bsc_rpc, bloxroute.as_deref(), bsc_key.as_deref(), &mut pub_con).await {
                    error!("buy execution failed: {}", e);
                }
            }
            CHANNELS.SELL_SIGNAL => {
                let signal: SellSignal = match serde_json::from_value(payload["payload"].clone()) {
                    Ok(s) => s,
                    Err(e) => { error!("bad sell signal: {}", e); continue; }
                };
                if let Err(e) = execute_sell(signal, live, &bsc_rpc, bloxroute.as_deref(), bsc_key.as_deref(), &mut pub_con).await {
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
    _rpc: &str,
    _bloxroute: Option<&str>,
    key: Option<&str>,
    con: &mut ConnectionManager,
) -> Result<()> {
    info!("BSC buy signal: {} ${}", signal.token.symbol, signal.amount_usd);

    if !live {
        info!("DRY interlock: LIVE_TRADING_ENABLED is false; not submitting transaction.");
        return Ok(());
    }

    let _key = key.context("no BSC key")?;

    // Real implementation:
    // 1. Connect ethers provider to BSC_RPC_URL
    // 2. Build PancakeSwap swapExactETHForTokens or swapExactTokensForTokens
    // 3. If bloxroute auth header is set, send via their private transaction endpoint
    // 4. Otherwise broadcast normally
    // 5. Publish TRADE_UPDATE

    let trade = Trade {
        id: format!("bsc-buy-{}", chrono::Utc::now().timestamp_millis()),
        token_id: signal.token.id.clone(),
        token_symbol: signal.token.symbol.clone(),
        token_address: signal.token.address.clone(),
        chain: Chain::Bsc,
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
    warn!("TODO: wire real PancakeSwap + BloxRoute submission");
    Ok(())
}

async fn execute_sell(
    signal: SellSignal,
    live: bool,
    _rpc: &str,
    _bloxroute: Option<&str>,
    key: Option<&str>,
    con: &mut ConnectionManager,
) -> Result<()> {
    info!("BSC sell signal: {} reason={}", signal.position.token_symbol, signal.reason);

    if !live {
        info!("DRY interlock: LIVE_TRADING_ENABLED is false; not submitting transaction.");
        return Ok(());
    }

    let _key = key.context("no BSC key")?;

    let trade = Trade {
        id: format!("bsc-sell-{}", chrono::Utc::now().timestamp_millis()),
        token_id: signal.position.token_id.clone(),
        token_symbol: signal.position.token_symbol.clone(),
        token_address: signal.position.token_address.clone(),
        chain: Chain::Bsc,
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
    warn!("TODO: wire real PancakeSwap + BloxRoute submission");
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
