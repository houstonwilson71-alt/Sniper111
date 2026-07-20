use std::env;

#[derive(Debug, Clone)]
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
}

impl EngineConfig {
    pub fn from_env() -> Self {
        Self {
            live_trading_enabled: env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true",
            grpc_addr: env::var("ENGINE_GRPC_ADDR").unwrap_or_else(|_| "0.0.0.0:50051".to_string()),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            nats_url: env::var("NATS_URL").ok(),
            solana_rpc_url: env::var("SOLANA_RPC_URL").unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string()),
            solana_ws_url: env::var("SOLANA_WS_URL").ok(),
            solana_private_key: env::var("SOLANA_PRIVATE_KEY").ok(),
            yellowstone_endpoint: env::var("YELLOWSTONE_ENDPOINT").ok(),
            yellowstone_token: env::var("YELLOWSTONE_TOKEN").ok(),
            helius_api_key: env::var("HELIUS_API_KEY").ok(),
            jupiter_api_url: env::var("JUPITER_API_URL").unwrap_or_else(|| "https://quote-api.jup.ag/v6".to_string()),
            jito_block_engine_url: env::var("JITO_BLOCK_ENGINE_URL").ok(),
            jito_tip_lamports: env::var("JITO_TIP_LAMPORTS").unwrap_or_default().parse().unwrap_or(10000),
            bsc_rpc_url: env::var("BSC_RPC_URL").unwrap_or_else(|_| "https://bsc-dataseed.binance.org/".to_string()),
            bsc_ws_url: env::var("BSC_WS_URL").ok(),
            bsc_private_key: env::var("BSC_PRIVATE_KEY").ok(),
            bloxroute_auth_header: env::var("BLOXROUTE_AUTH_HEADER").ok(),
            pancake_router_v2: env::var("PANCAKE_ROUTER_V2").unwrap_or_else(|_| "0x10ED43C718714eb63d5aA57B78B54704E256024E".to_string()),
            enabled: env::var("BOT_ENABLED").unwrap_or_else(|_| "true".to_string()) == "true",
        }
    }
}
