use std::env;
use std::time::Duration;
use anyhow::{Context, Result};
use redis::{aio::ConnectionManager, AsyncCommands, RedisResult};
use serde_json::json;
use tokio::time::interval;
use tracing::{info, warn, error};

mod grpc;
mod filter;

use common::{Token, TokenStatus, Chain, CHANNELS};

// This is a minimal Solana listener that reads from Helius RPC or Yellowstone gRPC.
// For production, wire the grpc module to Yellowstone gRPC or Helius webhooks.
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("info,listener_solana=debug"))
        .init();

    let live = env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true";
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let helius_key = env::var("HELIUS_API_KEY").ok();
    let solana_rpc = env::var("SOLANA_RPC_URL").unwrap_or_else(|| {
        helius_key.as_ref().map(|k| format!("https://mainnet.helius-rpc.com/?api-key={}", k))
            .unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string())
    });

    info!("Solana listener starting... live={} rpc={}", live, solana_rpc);

    let redis = redis::Client::open(redis_url)?;
    let mut con = ConnectionManager::new(redis).await?;

    if live {
        info!("LIVE mode: connecting to real Solana mainnet. This will cost real funds if executors are enabled.");
    }

    // Real integration: subscribe to Raydium/Orca/Meteora new pool events via Yellowstone gRPC or Helius webhook.
    // For the scaffold we poll Helius for recent Raydium CPAMM pools as a fallback.
    let mut ticker = interval(Duration::from_secs(10));
    let client = reqwest::Client::new();
    let program_id = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"; // Raydium AMM v4

    loop {
        ticker.tick().await;
        match fetch_new_pools(&client, &solana_rpc, program_id).await {
            Ok(pools) => {
                for pool in pools {
                    let token = pool_to_token(&pool);
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
                        info!("published token {} {}", token.symbol, token.address);
                    }
                }
            }
            Err(e) => warn!("pool fetch failed: {}", e),
        }
    }
}

async fn fetch_new_pools(client: &reqwest::Client, rpc: &str, program_id: &str) -> Result<Vec<PoolInfo>> {
    // Fetch new Raydium accounts created recently. In production use gRPC account subscriptions.
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getProgramAccounts",
        "params": [program_id, {
            "encoding": "jsonParsed",
            "filters": [{"dataSize": 752}],
            "commitment": "confirmed"
        }]
    });
    let res = client.post(rpc).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    let mut pools = vec![];
    if let Some(result) = json.get("result").and_then(|r| r.as_array()) {
        for account in result.iter().take(20) {
            let pubkey = account["pubkey"].as_str().unwrap_or("").to_string();
            pools.push(PoolInfo {
                address: pubkey.clone(),
                base_mint: format!("mint-{}", &pubkey[..8]),
                quote_mint: "So11111111111111111111111111111111111111112".to_string(),
                liquidity: 10000.0, // replace with real pool data from getAccountInfo
                unknown: true,
            });
        }
    }
    Ok(pools)
}

fn pool_to_token(pool: &PoolInfo) -> Token {
    Token {
        id: format!("solana-{}", pool.address),
        chain: Chain::Solana,
        address: pool.base_mint.clone(),
        symbol: format!("MEME-{}", &pool.address[..6]),
        name: format!("Unknown Solana Meme {}", &pool.address[..6]),
        liquidity_usd: pool.liquidity,
        holders: 0,
        age_seconds: 0,
        top10_pct: 0.0,
        rug_score: 0.0,
        volume_usd: 0.0,
        price_usd: 0.0,
        filter_passed: false,
        fail_reasons: vec![],
        detected_at: chrono::Utc::now().to_rfc3339(),
        pool_address: pool.address.clone(),
        mint_authority_revoked: None,
        freeze_authority_revoked: None,
        honeypot: None,
        buy_tax_pct: None,
        sell_tax_pct: None,
    }
}

#[derive(Debug)]
struct PoolInfo {
    address: String,
    base_mint: String,
    quote_mint: String,
    liquidity: f64,
    unknown: bool,
}
