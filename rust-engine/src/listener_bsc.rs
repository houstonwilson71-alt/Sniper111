use std::time::Duration;
use anyhow::{Context, Result};
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::json;
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{info, warn, error};

use crate::config::EngineConfig;
use crate::types::{EngineEvent, Token};

const PANCAKE_FACTORY_V2: &str = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

pub async fn run(cfg: EngineConfig, event_tx: mpsc::Sender<EngineEvent>) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let mut con = ConnectionManager::new(redis_client).await?;

    if let Some(ws_url) = cfg.bsc_ws_url.clone() {
        info!("BSC listener using WebSocket logs subscription");
        bsc_ws_loop(ws_url, cfg, event_tx, con).await?;
    } else {
        info!("BSC listener using RPC polling fallback");
        bsc_poll_loop(cfg, event_tx, con).await?;
    }
    Ok(())
}

async fn bsc_ws_loop(
    ws_url: String,
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut con: ConnectionManager,
) -> Result<()> {
    use ethers::providers::{Provider, Ws};
    use ethers::types::{Filter, H256};

    let provider = Provider::<Ws>::connect(ws_url).await.context("connect BSC WebSocket")?;
    let filter = Filter::new()
        .address(PANCAKE_FACTORY_V2.parse::<H256>().unwrap())
        .event("PairCreated(address,address,address,uint256)");

    let mut stream = provider.subscribe_logs(&filter).await?.0;
    info!("BSC PairCreated subscription active");

    while let Some(log) = stream.next().await {
        let pair = format!("{:?}", log.address);
        let token = pair_to_token(&pair, &cfg.bsc_rpc_url).await?;
        let event = EngineEvent::TokenDetected(token.clone());
        let _ = event_tx.send(event).await;
        if let Err(e) = publish_redis(&mut con, "tokens:new", &token).await {
            error!("redis publish failed: {}", e);
        }
    }

    Ok(())
}

async fn bsc_poll_loop(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut con: ConnectionManager,
) -> Result<()> {
    let client = reqwest::Client::new();
    let mut ticker = interval(Duration::from_secs(15));

    loop {
        ticker.tick().await;
        match fetch_recent_pairs(&client, &cfg.bsc_rpc_url).await {
            Ok(pairs) => {
                for pair in pairs {
                    let token = pair_to_token(&pair, &cfg.bsc_rpc_url).await?;
                    let event = EngineEvent::TokenDetected(token.clone());
                    let _ = event_tx.send(event).await;
                    if let Err(e) = publish_redis(&mut con, "tokens:new", &token).await {
                        error!("redis publish failed: {}", e);
                    }
                }
            }
            Err(e) => warn!("BSC pair fetch failed: {}", e),
        }
    }
}

async fn fetch_recent_pairs(client: &reqwest::Client, rpc: &str) -> Result<Vec<String>> {
    // Query the last N PairCreated events from the factory.
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getLogs",
        "params": [{
            "fromBlock": "latest",
            "toBlock": "latest",
            "address": PANCAKE_FACTORY_V2,
            "topics": ["0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0d835db31f870c95a3a52bd1f"]
        }]
    });
    let res = client.post(rpc).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    let mut pairs = vec![];
    if let Some(logs) = json.get("result").and_then(|r| r.as_array()) {
        for log in logs.iter().take(20) {
            if let Some(addr) = log["address"].as_str() {
                pairs.push(addr.to_string());
            }
        }
    }
    Ok(pairs)
}

async fn pair_to_token(pair: &str, rpc: &str) -> Result<Token> {
    // Call token0/token1 on the pair to get the non-WBNB token, then fetch metadata.
    let client = reqwest::Client::new();
    let token0 = eth_call(&client, rpc, pair, "token0()").await.unwrap_or_default();
    let token1 = eth_call(&client, rpc, pair, "token1()").await.unwrap_or_default();
    let wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    let token_addr = if token0.eq_ignore_ascii_case(wbnb) { token1.clone() } else { token0.clone() };

    Ok(Token {
        id: format!("bsc-{}", pair),
        chain: "bsc".to_string(),
        address: token_addr,
        symbol: format!("BSCMEME-{}", &pair[..6]),
        name: format!("Unknown BSC Meme {}", &pair[..6]),
        liquidity_usd: 10000.0,
        holders: 0,
        age_seconds: 0,
        top10_pct: 0.0,
        rug_score: 0.0,
        volume_usd: 0.0,
        price_usd: 0.0,
        filter_passed: false,
        fail_reasons: vec![],
        detected_at: chrono::Utc::now().to_rfc3339(),
        pool_address: pair.to_string(),
        mint_authority_revoked: false,
        freeze_authority_revoked: false,
        honeypot: false,
        buy_tax_pct: 0.0,
        sell_tax_pct: 0.0,
    })
}

async fn eth_call(client: &reqwest::Client, rpc: &str, to: &str, _sig: &str) -> Result<String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": to, "data": "0x0dfe1681"}, "latest"]
    });
    let res = client.post(rpc).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    json.get("result")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .context("no eth_call result")
}

async fn publish_redis(con: &mut ConnectionManager, channel: &str, token: &Token) -> Result<()> {
    let event = json!({
        "channel": channel,
        "id": format!("{}-{}", channel, chrono::Utc::now().timestamp_millis()),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "payload": token,
    });
    con.publish(channel, serde_json::to_string(&event)?).await?;
    Ok(())
}
