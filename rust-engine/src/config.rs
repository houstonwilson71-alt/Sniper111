use std::env;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub live_trading_enabled: bool,
    pub grpc_addr: String,
    pub redis_url: String,
    pub nats_url: Option<String>,
    pub solana_rpc_url: String,
    pub solana_ws_url: Option<String>,
    pub solana_private_key: Option<String>,
    pub yellowstone_endpoint: Option<String>,
    pub yellowstone_token: Option<String>,
    pub helius_api_key: Option<String>,
    pub jupiter_api_url: String,
    pub jito_block_engine_url: Option<String>,
    pub jito_tip_lamports: u64,
    pub bsc_rpc_url: String,
    pub bsc_ws_url: Option<String>,
    pub bsc_private_key: Option<String>,
    pub bloxroute_auth_header: Option<String>,
    pub pancake_router_v2: String,
    pub enabled: bool,
    // Trading parameters
    pub slippage_pct: f64,
    pub buy_amount_sol: f64,
    pub buy_amount_bnb: f64,
    // Position exit parameters
    pub tp1_pct: f64,
    pub trailing_stop_pct: f64,
    pub tp1_sell_pct: f64,
    pub time_exit_minutes: i64,
    pub time_exit_min_profit_pct: f64,
    // Filter parameters
    pub min_liquidity_usd: f64,
    pub max_token_age_seconds: i32,
    pub min_holders: i32,
    pub max_top10_pct: f64,
    pub max_rug_score: f64,
    pub min_volume_usd: f64,
}

impl EngineConfig {
    pub fn from_env() -> Self {
        Self {
            live_trading_enabled: env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true",
            grpc_addr: env::var("ENGINE_GRPC_ADDR").unwrap_or_else(|_| "0.0.0.0:50051".to_string()),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            nats_url: env::var("NATS_URL").ok(),
            solana_rpc_url: env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string()),
            solana_ws_url: env::var("SOLANA_WS_URL").ok(),
            solana_private_key: env::var("SOLANA_PRIVATE_KEY").ok(),
            yellowstone_endpoint: env::var("YELLOWSTONE_ENDPOINT").ok(),
            yellowstone_token: env::var("YELLOWSTONE_TOKEN").ok(),
            helius_api_key: env::var("HELIUS_API_KEY").ok(),
            jupiter_api_url: env::var("JUPITER_API_URL").unwrap_or_else(|_| "https://quote-api.jup.ag/v6".to_string()),
            jito_block_engine_url: env::var("JITO_BLOCK_ENGINE_URL").ok(),
            jito_tip_lamports: env::var("JITO_TIP_LAMPORTS").unwrap_or_default().parse().unwrap_or(10000),
            bsc_rpc_url: env::var("BSC_RPC_URL").unwrap_or_else(|_| "https://bsc-dataseed.binance.org/".to_string()),
            bsc_ws_url: env::var("BSC_WS_URL").ok(),
            bsc_private_key: env::var("BSC_PRIVATE_KEY").ok(),
            bloxroute_auth_header: env::var("BLOXROUTE_AUTH_HEADER").ok(),
            pancake_router_v2: env::var("PANCAKE_ROUTER_V2").unwrap_or_else(|_| "0x10ED43C718714eb63d5aA57B78B54704E256024E".to_string()),
            enabled: env::var("BOT_ENABLED").unwrap_or_else(|_| "true".to_string()) == "true",
            slippage_pct: env::var("SLIPPAGE_PCT").unwrap_or_default().parse().unwrap_or(1.0),
            buy_amount_sol: env::var("BUY_AMOUNT_SOL").unwrap_or_default().parse().unwrap_or(0.05),
            buy_amount_bnb: env::var("BUY_AMOUNT_BNB").unwrap_or_default().parse().unwrap_or(0.1),
            tp1_pct: env::var("TP1_PCT").unwrap_or_default().parse().unwrap_or(50.0),
            trailing_stop_pct: env::var("TRAILING_STOP_PCT").unwrap_or_default().parse().unwrap_or(20.0),
            tp1_sell_pct: env::var("TP1_SELL_PCT").unwrap_or_default().parse().unwrap_or(50.0),
            time_exit_minutes: env::var("TIME_EXIT_MINUTES").unwrap_or_default().parse().unwrap_or(60),
            time_exit_min_profit_pct: env::var("TIME_EXIT_MIN_PROFIT_PCT").unwrap_or_default().parse().unwrap_or(0.0),
            min_liquidity_usd: env::var("MIN_LIQUIDITY_USD").unwrap_or_default().parse().unwrap_or(10000.0),
            max_token_age_seconds: env::var("MAX_TOKEN_AGE_SECONDS").unwrap_or_default().parse().unwrap_or(3600),
            min_holders: env::var("MIN_HOLDERS").unwrap_or_default().parse().unwrap_or(50),
            max_top10_pct: env::var("MAX_TOP10_PCT").unwrap_or_default().parse().unwrap_or(80.0),
            max_rug_score: env::var("MAX_RUG_SCORE").unwrap_or_default().parse().unwrap_or(70.0),
            min_volume_usd: env::var("MIN_VOLUME_USD").unwrap_or_default().parse().unwrap_or(5000.0),
        }
    }
}
