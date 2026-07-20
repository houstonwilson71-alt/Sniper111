use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::config::EngineConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub id: String,
    pub chain: String,
    pub address: String,
    pub symbol: String,
    pub name: String,
    pub liquidity_usd: f64,
    pub holders: i32,
    pub age_seconds: i32,
    pub top10_pct: f64,
    pub rug_score: f64,
    pub volume_usd: f64,
    pub price_usd: f64,
    pub filter_passed: bool,
    pub fail_reasons: Vec<String>,
    pub detected_at: String,
    pub pool_address: String,
    pub mint_authority_revoked: bool,
    pub freeze_authority_revoked: bool,
    pub honeypot: bool,
    pub buy_tax_pct: f64,
    pub sell_tax_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: String,
    pub token_id: String,
    pub token_symbol: String,
    pub token_address: String,
    pub chain: String,
    pub entry_price_usd: f64,
    pub current_price_usd: f64,
    pub peak_price_usd: f64,
    pub size_usd: f64,
    pub status: String,
    pub tp1_hit: bool,
    pub trailing_stop_active: bool,
    pub stop_loss_price: f64,
    pub unrealised_pnl_usd: f64,
    pub unrealised_pnl_pct: f64,
    pub opened_at: String,
    pub closed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub token_id: String,
    pub token_symbol: String,
    pub chain: String,
    pub side: String,
    pub amount_usd: f64,
    pub price_usd: f64,
    pub tx_hash: String,
    pub status: String,
    pub fees_usd: f64,
    pub pnl_usd: Option<f64>,
    pub pnl_pct: Option<f64>,
    pub executed_at: String,
    pub sell_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Command {
    UpdateConfig(EngineConfig),
    Start,
    Stop,
    EmergencyStop(String),
    ResetEmergency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineEvent {
    TokenDetected(Token),
    TokenFiltered { token_id: String, passed: bool, reasons: Vec<String> },
    BuySignal { token: Token, amount_usd: f64, slippage_pct: f64, jito_tip_lamports: u64 },
    SellSignal { position: Position, reason: String, sell_pct: f64, target_price_usd: Option<f64> },
    TradeUpdate(Trade),
    PositionUpdate(Position),
    Log { level: String, message: String },
}

impl EngineEvent {
    pub fn wrap(self, channel: &str) -> serde_json::Value {
        serde_json::json!({
            "channel": channel,
            "id": format!("{}- {}", channel, Utc::now().timestamp_millis()),
            "timestamp": Utc::now().to_rfc3339(),
            "payload": self,
        })
    }
}
