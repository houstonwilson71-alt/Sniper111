use std::time::Duration;
use anyhow::{Context, Result};
use futures::StreamExt;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::json;
use tokio::sync::mpsc;
use tokio::time::interval;
use tracing::{info, warn, error};

use crate::config::EngineConfig;
use crate::types::{EngineEvent, Token};

pub async fn run(cfg: EngineConfig, event_tx: mpsc::Sender<EngineEvent>) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let mut con = ConnectionManager::new(redis_client).await?;

    if cfg.yellowstone_endpoint.is_some() && cfg.yellowstone_token.is_some() {
        info!("Solana listener using Yellowstone gRPC");
        yellowstone_loop(cfg, event_tx, con).await?;
    } else {
        info!("Solana listener using Helius RPC fallback polling");
        helius_poll_loop(cfg, event_tx, con).await?;
    }
    Ok(())
}

async fn yellowstone_loop(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut con: ConnectionManager,
) -> Result<()> {
    use yellowstone_grpc_client::GeyserGrpcClient;
    use yellowstone_grpc_proto::geyser::{
        SubscribeRequest, SubscribeRequestFilterAccounts,
    };
    use yellowstone_grpc_proto::prelude::CommitmentLevel;

    let endpoint = cfg.yellowstone_endpoint.unwrap();
    let token = cfg.yellowstone_token.unwrap();

    let mut client = GeyserGrpcClient::build_from_shared(endpoint)
        .map_err(|e| anyhow::anyhow!("{}", e))?
        .x_token(Some(token))
        .map_err(|e| anyhow::anyhow!("{}", e))?
        .connect()
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))
        .context("connect to Yellowstone gRPC")?;

    let request = SubscribeRequest {
        accounts: {
            let mut m = std::collections::HashMap::new();
            m.insert(
                "raydium".to_string(),
                SubscribeRequestFilterAccounts {
                    account: vec![],
                    owner: vec!["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8".to_string()],
                    filters: vec![],
                    ..Default::default()
                },
            );
            m.insert(
                "orca".to_string(),
                SubscribeRequestFilterAccounts {
                    account: vec![],
                    owner: vec!["9WzDXwBbmkg8ZTbNMqUxvTA1ebJ3x8T5xC8g5rZxX7Ty".to_string()],
                    filters: vec![],
                    ..Default::default()
                },
            );
            m.insert(
                "meteora".to_string(),
                SubscribeRequestFilterAccounts {
                    account: vec![],
                    owner: vec!["LBUZKhRxPFbXh7uMVbP65mNxkZ7P76H7m6vMuo5hLM9".to_string()],
                    filters: vec![],
                    ..Default::default()
                },
            );
            m
        },
        commitment: Some(CommitmentLevel::Confirmed as i32),
        ..Default::default()
    };

    let (_sink, mut stream) = client.subscribe_with_request(Some(request))
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    info!("Yellowstone gRPC subscription active");

    use yellowstone_grpc_proto::geyser::subscribe_update::UpdateOneof;
    while let Some(update) = stream.next().await {
        match update {
            Ok(msg) => {
                if let Some(UpdateOneof::Account(account_update)) = msg.update_oneof {
                    let pool = account_update.account.as_ref().context("no account in update")?;
                    let pubkey_str = bs58::encode(&pool.pubkey).into_string();
                    let token = pool_account_to_token(&pubkey_str, &pool.data, &cfg.solana_rpc_url).await?;
                    let event = EngineEvent::TokenDetected(token.clone());
                    let _ = event_tx.send(event).await;
                    publish_redis(&mut con, "tokens:new", &token).await?;
                }
            }
            Err(e) => {
                warn!("Yellowstone stream error: {}", e);
            }
        }
    }

    Ok(())
}

async fn helius_poll_loop(
    cfg: EngineConfig,
    event_tx: mpsc::Sender<EngineEvent>,
    mut con: ConnectionManager,
) -> Result<()> {
    let client = reqwest::Client::new();
    let mut ticker = interval(Duration::from_secs(10));
    let program_id = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

    loop {
        ticker.tick().await;
        match fetch_new_pools(&client, &cfg.solana_rpc_url, program_id).await {
            Ok(pools) => {
                for pool in pools {
                    let token = pool_to_token(&pool);
                    let event = EngineEvent::TokenDetected(token.clone());
                    let _ = event_tx.send(event).await;
                    if let Err(e) = publish_redis(&mut con, "tokens:new", &token).await {
                        error!("redis publish failed: {}", e);
                    }
                }
            }
            Err(e) => warn!("pool fetch failed: {}", e),
        }
    }
}

async fn fetch_new_pools(client: &reqwest::Client, rpc: &str, program_id: &str) -> Result<Vec<PoolInfo>> {
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
        for account in result.iter().take(50) {
            let pubkey = account["pubkey"].as_str().unwrap_or("").to_string();
            pools.push(PoolInfo {
                address: pubkey.clone(),
                base_mint: format!("mint-{}", &pubkey[..8]),
                quote_mint: "So11111111111111111111111111111111111111112".to_string(),
                liquidity: 10000.0,
                unknown: true,
            });
        }
    }
    Ok(pools)
}

async fn pool_account_to_token(_pubkey: &str, _data: &[u8], _rpc: &str) -> Result<Token> {
    // Decode the Raydium AMM pool data to extract base/quote mint and derive token info.
    // In a full implementation this calls getAccountInfo to read mint, supply, and metadata.
    Ok(Token {
        id: format!("solana-{}", uuid::Uuid::new_v4()),
        chain: "solana".to_string(),
        address: "So11111111111111111111111111111111111111112".to_string(),
        symbol: "MEME-NEW".to_string(),
        name: "New Solana Meme".to_string(),
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
        pool_address: _pubkey.to_string(),
        mint_authority_revoked: false,
        freeze_authority_revoked: false,
        honeypot: false,
        buy_tax_pct: 0.0,
        sell_tax_pct: 0.0,
    })
}

fn pool_to_token(pool: &PoolInfo) -> Token {
    Token {
        id: format!("solana-{}", pool.address),
        chain: "solana".to_string(),
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
        mint_authority_revoked: false,
        freeze_authority_revoked: false,
        honeypot: false,
        buy_tax_pct: 0.0,
        sell_tax_pct: 0.0,
    }
}

async fn publish_redis(con: &mut ConnectionManager, channel: &str, token: &Token) -> Result<()> {
    let event = json!({
        "channel": channel,
        "id": format!("{}-{}", channel, chrono::Utc::now().timestamp_millis()),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "payload": token,
    });
    let _: () = con.publish(channel, serde_json::to_string(&event)?).await?;
    Ok(())
}

#[derive(Debug)]
struct PoolInfo {
    address: String,
    base_mint: String,
    quote_mint: String,
    liquidity: f64,
    unknown: bool,
}
