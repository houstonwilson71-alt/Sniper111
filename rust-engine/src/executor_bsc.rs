use std::str::FromStr;
use std::sync::Arc;
use anyhow::{anyhow, Context, Result};
use ethers::prelude::*;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tracing::{info, warn, error};

use crate::config::EngineConfig;
use crate::types::{EngineEvent, Position, Trade};

const WBNB: &str = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const PANCAKE_ROUTER_V2_ABI: &str = include_str!("./pancake_router_v2_abi.json");

pub async fn run(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let con = ConnectionManager::new(redis_client).await?;
    let mut pub_con = con.clone();
    let mut sub = con.into_pubsub();
    sub.subscribe("buy:bsc").await?;
    sub.subscribe("sell:bsc").await?;
    let mut stream = sub.on_message();

    let provider = Arc::new(Provider::<Http>::try_from(&cfg.bsc_rpc_url)?);
    let wallet = cfg.bsc_private_key.as_ref().map(|k| {
        k.parse::<LocalWallet>().map(|w| w.with_chain_id(Chain::BinanceSmartChain as u64))
    });

    let router: Address = cfg.pancake_router_v2.parse()?;

    loop {
        tokio::select! {
            Some(msg) = stream.next() => {
                let payload: Value = serde_json::from_str(&msg.get_payload::<String>().unwrap_or_default()).unwrap_or_default();
                match payload["channel"].as_str().unwrap_or("") {
                    "buy:bsc" => {
                        let signal: crate::types::EngineEvent = serde_json::from_value(payload["payload"].clone()).unwrap();
                        if let crate::types::EngineEvent::BuySignal { token, amount_usd, slippage_pct, .. } = signal {
                            if let Err(e) = execute_buy(&cfg, &token, amount_usd, slippage_pct, provider.clone(), wallet.as_ref(), router, &mut pub_con, &event_tx).await {
                                error!("BSC buy failed: {}", e);
                            }
                        }
                    }
                    "sell:bsc" => {
                        let signal: crate::types::EngineEvent = serde_json::from_value(payload["payload"].clone()).unwrap();
                        if let crate::types::EngineEvent::SellSignal { position, reason, sell_pct, target_price_usd } = signal {
                            if let Err(e) = execute_sell(&cfg, &position, &reason, sell_pct, target_price_usd, provider.clone(), wallet.as_ref(), router, &mut pub_con, &event_tx).await {
                                error!("BSC sell failed: {}", e);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

async fn execute_buy(
    cfg: &EngineConfig,
    token: &crate::types::Token,
    amount_usd: f64,
    slippage_pct: f64,
    provider: Arc<Provider<Http>>,
    wallet: Option<&Result<LocalWallet, String>>,
    router: Address,
    con: &mut ConnectionManager,
    event_tx: &mpsc::Sender<EngineEvent>,
) -> Result<()> {
    info!("BSC BUY {} {} amount=${} slippage={}%", token.symbol, token.address, amount_usd, slippage_pct);

    if !cfg.live_trading_enabled {
        info!("DRY interlock: skipping real BSC transaction");
        let trade = build_bsc_trade(token, "buy", amount_usd, None, "dry-run");
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
        return Ok(());
    }

    let wallet = wallet.context("no wallet")?.as_ref().map_err(|e| anyhow!("{}", e))?;
    let client = SignerMiddleware::new(provider, wallet.clone());

    let wbnb: Address = WBNB.parse()?;
    let token_addr: Address = token.address.parse()?;
    let amount_in = U256::from((amount_usd / 600.0 * 1e18) as u128); // rough BNB amount

    let router_contract = Contract::<SignerMiddleware<Arc<Provider<Http>>, LocalWallet>>::from_json(
        client.clone(),
        router,
        PANCAKE_ROUTER_V2_ABI.as_bytes(),
    )?;

    let path = vec![wbnb, token_addr];
    let deadline = U256::from(chrono::Utc::now().timestamp() + 60);

    let tx = router_contract
        .method::<_, H256>("swapExactETHForTokens", (U256::zero(), path, wallet.address(), deadline))?
        .value(amount_in)
        .send()
        .await?;

    let tx_hash = format!("{:?}", tx.tx_hash());
    info!("BSC buy tx: {}", tx_hash);

    let trade = build_bsc_trade(token, "buy", amount_usd, Some(tx_hash.clone()), "confirmed");
    publish_trade(con, &trade).await?;
    event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();

    // Open position
    let position = Position {
        id: format!("pos-bsc-{}", uuid::Uuid::new_v4()),
        token_id: token.id.clone(),
        token_symbol: token.symbol.clone(),
        token_address: token.address.clone(),
        chain: "bsc".to_string(),
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

    // BloxRoute private relay if configured
    if let Some(auth) = &cfg.bloxroute_auth_header {
        let _ = relay_via_bloxroute(auth, &tx_hash, &cfg.bsc_rpc_url).await;
    }

    Ok(())
}

async fn execute_sell(
    cfg: &EngineConfig,
    position: &Position,
    reason: &str,
    sell_pct: f64,
    _target_price_usd: Option<f64>,
    provider: Arc<Provider<Http>>,
    wallet: Option<&Result<LocalWallet, String>>,
    router: Address,
    con: &mut ConnectionManager,
    event_tx: &mpsc::Sender<EngineEvent>,
) -> Result<()> {
    info!("BSC SELL {} reason={} sell_pct={}%", position.token_symbol, reason, sell_pct);

    if !cfg.live_trading_enabled {
        info!("DRY interlock: skipping real BSC sell");
        let trade = build_bsc_sell_trade(position, sell_pct, reason, None);
        publish_trade(con, &trade).await?;
        event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();
        return Ok(());
    }

    let wallet = wallet.context("no wallet")?.as_ref().map_err(|e| anyhow!("{}", e))?;
    let client = SignerMiddleware::new(provider, wallet.clone());
    let token_addr: Address = position.token_address.parse()?;
    let wbnb: Address = WBNB.parse()?;
    let amount_in = U256::from((position.size_usd * sell_pct / 100.0 / 600.0 * 1e18) as u128);
    let deadline = U256::from(chrono::Utc::now().timestamp() + 60);

    let router_contract = Contract::<SignerMiddleware<Arc<Provider<Http>>, LocalWallet>>::from_json(
        client.clone(),
        router,
        PANCAKE_ROUTER_V2_ABI.as_bytes(),
    )?;

    let tx = router_contract
        .method::<_, H256>("swapExactTokensForETH", (amount_in, U256::zero(), vec![token_addr, wbnb], wallet.address(), deadline))?
        .send()
        .await?;

    let tx_hash = format!("{:?}", tx.tx_hash());
    info!("BSC sell tx: {}", tx_hash);

    let trade = build_bsc_sell_trade(position, sell_pct, reason, Some(tx_hash.clone()));
    publish_trade(con, &trade).await?;
    event_tx.send(EngineEvent::TradeUpdate(trade)).await.ok();

    if let Some(auth) = &cfg.bloxroute_auth_header {
        let _ = relay_via_bloxroute(auth, &tx_hash, &cfg.bsc_rpc_url).await;
    }

    Ok(())
}

async fn relay_via_bloxroute(auth: &str, tx_hash: &str, _rpc: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let body = json!({
        "transaction_hash": tx_hash
    });
    let res = client
        .post("https://api.blxrbdn.com/v1/private-tx")
        .header("Authorization", auth)
        .json(&body)
        .send()
        .await?;
    info!("BloxRoute relay response: {:?}", res.status());
    Ok(())
}

fn build_bsc_trade(token: &crate::types::Token, side: &str, amount_usd: f64, tx_hash: Option<String>, status: &str) -> Trade {
    Trade {
        id: format!("bsc-{}-{}", side, chrono::Utc::now().timestamp_millis()),
        token_id: token.id.clone(),
        token_symbol: token.symbol.clone(),
        chain: "bsc".to_string(),
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

fn build_bsc_sell_trade(position: &Position, sell_pct: f64, reason: &str, tx_hash: Option<String>) -> Trade {
    Trade {
        id: format!("bsc-sell-{}", chrono::Utc::now().timestamp_millis()),
        token_id: position.token_id.clone(),
        token_symbol: position.token_symbol.clone(),
        chain: "bsc".to_string(),
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
