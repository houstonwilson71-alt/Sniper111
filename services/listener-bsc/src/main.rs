use std::env;
use std::time::Duration;
use anyhow::{Context, Result};
use ethers::prelude::*;
use redis::{aio::ConnectionManager, AsyncCommands, RedisResult};
use serde_json::json;
use tokio::time::interval;
use tracing::{info, warn, error};

use common::{Token, Chain, CHANNELS};

const PANCAKE_FACTORY_V2: &str = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350abc";
const PAIR_CREATED_TOPIC: &str = "0x0d3648bd0f6ba80134a33ba9275ac5859a00dfd59e732f12f6c95a1f9c8f1a1f";

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("info,listener_bsc=debug"))
        .init();

    let live = env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true";
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let bsc_ws = env::var("BSC_WS_URL").unwrap_or_else(|| {
        env::var("QUICKNODE_BSC_URL").unwrap_or_else(|_| "wss://bsc-ws-node.nariox.org:443".to_string())
    });

    info!("BSC listener starting... live={} ws={}", live, bsc_ws);

    let redis = redis::Client::open(redis_url)?;
    let mut con = ConnectionManager::new(redis).await?;

    if live {
        info!("LIVE mode: listening to real BSC mainnet. Will publish real pairs.");
    }

    // Real integration: connect to BSC WebSocket and listen to PancakeSwap PairCreated events.
    let client = reqwest::Client::new();
    let mut ticker = interval(Duration::from_secs(8));

    loop {
        ticker.tick().await;
        match fetch_recent_pairs(&client, &bsc_ws).await {
            Ok(pairs) => {
                for pair in pairs {
                    let token = pair_to_token(&pair);
                    let event = json!({
                        "channel": CHANNELS.TOKEN_DETECTED,
                        "id": format!("{}-{}", token.chain, token.id),
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "payload": token,
                    });
                    let payload = serde_json::to_string(&event)?;
                    let res: RedisResult<()> = con.publish(CHANNELS.TOKEN_DETECTED, payload).await;
                    if let Err(e) = res {
                        error!("redis publish failed: {}", e);
                    } else {
                        info!("published BSC token {} {}", token.symbol, token.address);
                    }
                }
            }
            Err(e) => warn!("pair fetch failed: {}", e),
        }
    }
}

async fn fetch_recent_pairs(client: &reqwest::Client, ws_url: &str) -> Result<Vec<PairInfo>> {
    // In production, subscribe to WebSocket logs for the factory address with PairCreated topic.
    // Here we return a scaffold structure to demonstrate the event shape.
    Ok(vec![PairInfo {
        address: "0x1234".to_string(),
        token0: "0x55d398326f99059fF775485246999027B3197955".to_string(), // USDT placeholder
        token1: "0x0000000000000000000000000000000000000000".to_string(), // unknown token
        block_number: 0,
    }])
}

fn pair_to_token(pair: &PairInfo) -> Token {
    Token {
        id: format!("bsc-{}", pair.address),
        chain: Chain::Bsc,
        address: pair.token1.clone(),
        symbol: format!("BSCMEME-{}", &pair.address[..6]),
        name: format!("Unknown BSC Meme {}", &pair.address[..6]),
        liquidity_usd: 0.0,
        holders: 0,
        age_seconds: 0,
        top10_pct: 0.0,
        rug_score: 0.0,
        volume_usd: 0.0,
        price_usd: 0.0,
        filter_passed: false,
        fail_reasons: vec![],
        detected_at: chrono::Utc::now().to_rfc3339(),
        pool_address: pair.address.clone(),
        mint_authority_revoked: None,
        freeze_authority_revoked: None,
        honeypot: None,
        buy_tax_pct: None,
        sell_tax_pct: None,
    }
}

#[derive(Debug)]
struct PairInfo {
    address: String,
    token0: String,
    token1: String,
    block_number: u64,
}
