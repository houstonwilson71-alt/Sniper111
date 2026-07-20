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
use crate::safety::{apply_filters, check_bsc, check_solana};
use crate::types::{EngineEvent, Token};

pub async fn run(cfg: EngineConfig, event_tx: mpsc::Sender<EngineEvent>) -> Result<()> {
    let redis_client = redis::Client::open(cfg.redis_url.clone())?;
    let mut sub = redis_client.get_async_pubsub().await?;
    sub.subscribe("tokens:new").await?;
    let mut stream = sub.on_message();

    let mut pending = HashMap::<String, Token>::new();
    let mut ticker = interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            Some(msg) = stream.next() => {
                let payload = msg.get_payload::<String>().unwrap_or_default();
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&payload) {
                    if let Ok(token) = serde_json::from_value::<Token>(event["payload"].clone()) {
                        pending.insert(token.id.clone(), token);
                    }
                }
            }
            _ = ticker.tick() => {
                let ids: Vec<String> = pending.keys().cloned().collect();
                for id in ids {
                    if let Some(token) = pending.remove(&id) {
                        if let Err(e) = evaluate_and_emit(&cfg, &token, &event_tx).await {
                            warn!("filter evaluation failed for {}: {}", token.id, e);
                        }
                    }
                }
            }
        }
    }
}

async fn evaluate_and_emit(cfg: &EngineConfig, token: &Token, event_tx: &mpsc::Sender<EngineEvent>) -> Result<()> {
    let safety = match token.chain.as_str() {
        "solana" => check_solana(token, &cfg.solana_rpc_url).await.unwrap_or_default(),
        "bsc" => check_bsc(token, &cfg.bsc_rpc_url).await.unwrap_or_default(),
        _ => Default::default(),
    };

    let result = apply_filters(token, cfg, &safety);
    let mut token = token.clone();
    token.filter_passed = result.passed;
    token.fail_reasons = result.reasons.clone();
    token.mint_authority_revoked = result.mint_revoked;
    token.freeze_authority_revoked = result.freeze_revoked;
    token.honeypot = result.honeypot;
    token.buy_tax_pct = result.buy_tax_pct;
    token.sell_tax_pct = result.sell_tax_pct;

    event_tx.send(EngineEvent::TokenFiltered {
        token_id: token.id.clone(),
        passed: result.passed,
        reasons: result.reasons.clone(),
    }).await.ok();

    info!("token {} filtered passed={} reasons={:?}", token.id, result.passed, result.reasons);

    if result.passed && cfg.enabled {
        let amount = if token.chain == "solana" { cfg.buy_amount_sol } else { cfg.buy_amount_bnb };
        // Approximate USD value of the buy amount for the dashboard.
        let amount_usd = if token.chain == "solana" { amount * 150.0 } else { amount * 600.0 };
        event_tx.send(EngineEvent::BuySignal {
            token: token.clone(),
            amount_usd,
            slippage_pct: cfg.slippage_pct,
            jito_tip_lamports: cfg.jito_tip_lamports,
        }).await.ok();
    }

    Ok(())
}
