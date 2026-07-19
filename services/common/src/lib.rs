use serde::{Deserialize, Serialize};

pub const TOKEN_DETECTED: &str = "sniper.token.detected";
pub const TOKEN_FILTERED: &str = "sniper.token.filtered";
pub const BUY_SIGNAL: &str = "sniper.signal.buy";
pub const SELL_SIGNAL: &str = "sniper.signal.sell";
pub const TRADE_UPDATE: &str = "sniper.trade.update";
pub const POSITION_UPDATE: &str = "sniper.position.update";
pub const PRICE_UPDATE: &str = "sniper.price.update";
pub const BOT_STATE: &str = "sniper.bot.state";
pub const EMERGENCY_STOP: &str = "sniper.emergency.stop";
pub const DASHBOARD_FEED: &str = "sniper.dashboard.feed";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Solana,
    Bsc,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokenStatus {
    Pending,
    Filtered,
    Passed,
    Failed,
    Bought,
    Sold,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TradeSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TradeStatus {
    Pending,
    Confirmed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    pub id: String,
    pub chain: Chain,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mint_authority_revoked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freeze_authority_revoked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub honeypot: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buy_tax_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sell_tax_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotConfig {
    pub id: Option<i32>,
    pub enable_solana: bool,
    pub enable_bsc: bool,
    pub min_liquidity_usd: f64,
    pub max_token_age_seconds: i32,
    pub min_holders: i32,
    pub max_top10_pct: f64,
    pub max_rug_score: f64,
    pub min_volume_usd: f64,
    pub buy_amount_sol: f64,
    pub buy_amount_bnb: f64,
    pub slippage_pct: f64,
    pub jito_tip_lamports: i64,
    pub tp1_pct: f64,
    pub tp1_sell_pct: f64,
    pub trailing_stop_pct: f64,
    pub time_exit_minutes: i32,
    pub time_exit_min_profit_pct: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotState {
    pub id: Option<i32>,
    pub running: bool,
    pub started_at: Option<String>,
    pub stopped_at: Option<String>,
    pub error: Option<String>,
    pub emergency_stopped: bool,
    pub live_trading_enabled: bool,
    pub wallet_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub id: String,
    pub token_id: String,
    pub token_symbol: String,
    pub token_address: String,
    pub chain: Chain,
    pub entry_price_usd: f64,
    pub current_price_usd: f64,
    pub peak_price_usd: f64,
    pub size_usd: f64,
    pub status: String,
    pub tp1_hit: bool,
    pub tp2_hit: bool,
    pub trailing_stop_active: bool,
    pub stop_loss_price: Option<f64>,
    pub unrealised_pnl_usd: f64,
    pub unrealised_pnl_pct: f64,
    pub realised_pnl_usd: Option<f64>,
    pub opened_at: String,
    pub closed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trade {
    pub id: String,
    pub token_id: String,
    pub token_symbol: String,
    pub token_address: String,
    pub chain: Chain,
    pub position_id: String,
    pub side: TradeSide,
    pub amount_usd: f64,
    pub price_usd: f64,
    pub tx_hash: String,
    pub status: TradeStatus,
    pub fees_usd: f64,
    pub pnl_usd: Option<f64>,
    pub pnl_pct: Option<f64>,
    pub executed_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sell_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuySignal {
    pub token: Token,
    pub amount_usd: f64,
    pub slippage_pct: f64,
    pub jito_tip_lamports: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SellSignal {
    pub position: Position,
    pub reason: String,
    pub sell_pct: f64,
    pub target_price_usd: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletConfig {
    pub solana_private_key: Option<String>,
    pub bsc_private_key: Option<String>,
    pub use_wallet_connect: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityPoint {
    pub timestamp: String,
    pub equity_usd: f64,
    pub pnl_usd: f64,
}
