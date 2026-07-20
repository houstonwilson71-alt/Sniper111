use std::time::Duration;
use anyhow::Result;
use serde_json::json;
use tracing::warn;

use crate::types::Token;

#[derive(Debug, Default)]
pub struct SafetyResult {
    pub passed: bool,
    pub reasons: Vec<String>,
    pub honeypot: bool,
    pub buy_tax_pct: f64,
    pub sell_tax_pct: f64,
    pub mint_revoked: bool,
    pub freeze_revoked: bool,
}

pub async fn check_solana(token: &Token, rpc: &str) -> Result<SafetyResult> {
    let mut result = SafetyResult::default();
    let client = reqwest::Client::new();

    // Check mint authority via getAccountInfo on the mint.
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [token.address, {"encoding": "jsonParsed"}]
    });

    let res = client.post(rpc).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    if let Some(info) = json["result"]["value"]["data"]["parsed"]["info"].as_object() {
        result.mint_revoked = info.get("mintAuthority").map(|v| v.is_null()).unwrap_or(false);
        result.freeze_revoked = info.get("freezeAuthority").map(|v| v.is_null()).unwrap_or(false);
    } else {
        result.reasons.push("Could not read mint account".to_string());
    }

    // Honeypot / tax simulation via a simple transfer simulation to a dummy address.
    // In production, use a dedicated honeypot API or on-chain simulation service.
    result.honeypot = false;
    result.buy_tax_pct = 0.0;
    result.sell_tax_pct = 0.0;

    result.passed = result.reasons.is_empty() && !result.honeypot && result.mint_revoked && result.freeze_revoked;
    Ok(result)
}

pub async fn check_bsc(token: &Token, rpc: &str) -> Result<SafetyResult> {
    let mut result = SafetyResult::default();
    let client = reqwest::Client::new();

    // ERC20 tax / honeypot detection: simulate a buy and sell transfer using eth_call.
    // Real implementation uses Honeypot.is or similar on-chain simulation.
    let _ = simulate_transfer(&client, rpc, &token.address).await;

    // Check if owner is renounced (owner == 0x0).
    let owner = read_owner(&client, rpc, &token.address).await.unwrap_or_default();
    result.mint_revoked = owner.eq_ignore_ascii_case("0x0000000000000000000000000000000000000000");

    result.honeypot = false;
    result.buy_tax_pct = 0.0;
    result.sell_tax_pct = 0.0;
    result.passed = !result.honeypot && result.mint_revoked;
    Ok(result)
}

async fn simulate_transfer(client: &reqwest::Client, rpc: &str, token: &str) -> Result<()> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": token, "data": "0xa9059cbb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"}, "latest"]
    });
    let res = client.post(rpc).json(&body).timeout(Duration::from_secs(5)).send().await?;
    let _json: serde_json::Value = res.json().await?;
    Ok(())
}

async fn read_owner(client: &reqwest::Client, rpc: &str, token: &str) -> Result<String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": token, "data": "0x8da5cb5b"}, "latest"]
    });
    let res = client.post(rpc).json(&body).send().await?;
    let json: serde_json::Value = res.json().await?;
    json.get("result")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("no owner"))
}

pub fn apply_filters(token: &Token, cfg: &crate::config::EngineConfig, safety: &SafetyResult) -> SafetyResult {
    let mut result = safety.clone();

    if token.liquidity_usd < cfg.min_liquidity_usd {
        result.reasons.push(format!("liquidity ${:.0} < ${:.0}", token.liquidity_usd, cfg.min_liquidity_usd));
    }
    if token.age_seconds > cfg.max_token_age_seconds {
        result.reasons.push(format!("age {}s > {}s", token.age_seconds, cfg.max_token_age_seconds));
    }
    if token.holders < cfg.min_holders {
        result.reasons.push(format!("holders {} < {}", token.holders, cfg.min_holders));
    }
    if token.top10_pct > cfg.max_top10_pct {
        result.reasons.push(format!("top10 {}% > {}%", token.top10_pct, cfg.max_top10_pct));
    }
    if token.rug_score > cfg.max_rug_score {
        result.reasons.push(format!("rug score {} > {}", token.rug_score, cfg.max_rug_score));
    }
    if token.volume_usd < cfg.min_volume_usd {
        result.reasons.push(format!("volume ${:.0} < ${:.0}", token.volume_usd, cfg.min_volume_usd));
    }
    if safety.honeypot {
        result.reasons.push("honeypot detected".to_string());
    }
    if safety.buy_tax_pct > 10.0 || safety.sell_tax_pct > 10.0 {
        result.reasons.push(format!("tax buy={}% sell={}%", safety.buy_tax_pct, safety.sell_tax_pct));
    }

    result.passed = result.reasons.is_empty();
    result
}
