-- PostgreSQL schema for the Go backend (services/api-go).
-- This is the canonical Docker schema; the Node.js API uses its own Drizzle migrations.

CREATE TABLE IF NOT EXISTS bot_config (
  id SERIAL PRIMARY KEY,
  enable_solana BOOLEAN NOT NULL DEFAULT true,
  enable_bsc BOOLEAN NOT NULL DEFAULT true,
  min_liquidity_usd REAL NOT NULL DEFAULT 5000,
  max_token_age_seconds INTEGER NOT NULL DEFAULT 300,
  min_holders INTEGER NOT NULL DEFAULT 25,
  max_top10_pct REAL NOT NULL DEFAULT 35,
  max_rug_score REAL NOT NULL DEFAULT 2,
  min_volume_usd REAL NOT NULL DEFAULT 1000,
  buy_amount_sol REAL NOT NULL DEFAULT 0.01,
  buy_amount_bnb REAL NOT NULL DEFAULT 0.01,
  slippage_pct REAL NOT NULL DEFAULT 15,
  jito_tip_lamports INTEGER NOT NULL DEFAULT 10000,
  tp1_pct REAL NOT NULL DEFAULT 100,
  tp1_sell_pct REAL NOT NULL DEFAULT 50,
  tp2_pct REAL NOT NULL DEFAULT 500,
  tp2_sell_pct REAL NOT NULL DEFAULT 50,
  trailing_stop_pct REAL NOT NULL DEFAULT 25,
  time_exit_minutes INTEGER NOT NULL DEFAULT 120,
  time_exit_min_profit_pct REAL NOT NULL DEFAULT 20,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_state (
  id SERIAL PRIMARY KEY,
  running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  emergency_stopped BOOLEAN NOT NULL DEFAULT false,
  live_trading_enabled BOOLEAN NOT NULL DEFAULT false,
  wallet_address TEXT
);

CREATE TABLE IF NOT EXISTS wallet_config (
  id SERIAL PRIMARY KEY,
  solana_private_key TEXT,
  bsc_private_key TEXT,
  use_wallet_connect BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  pool_address TEXT,
  liquidity_usd REAL NOT NULL DEFAULT 0,
  holders INTEGER NOT NULL DEFAULT 0,
  age_seconds INTEGER NOT NULL DEFAULT 0,
  top10_pct REAL NOT NULL DEFAULT 0,
  rug_score REAL NOT NULL DEFAULT 0,
  volume_usd REAL NOT NULL DEFAULT 0,
  price_usd REAL,
  filter_passed BOOLEAN NOT NULL DEFAULT false,
  fail_reasons JSONB,
  mint_authority_revoked BOOLEAN NOT NULL DEFAULT false,
  freeze_authority_revoked BOOLEAN NOT NULL DEFAULT false,
  honeypot BOOLEAN NOT NULL DEFAULT false,
  buy_tax_pct REAL NOT NULL DEFAULT 0,
  sell_tax_pct REAL NOT NULL DEFAULT 0,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  position_id TEXT,
  side TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  price_usd REAL NOT NULL,
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  fees_usd REAL,
  pnl_usd REAL,
  pnl_pct REAL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sell_reason TEXT
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  entry_price_usd REAL NOT NULL,
  current_price_usd REAL NOT NULL,
  peak_price_usd REAL NOT NULL,
  size_usd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  tp1_hit BOOLEAN NOT NULL DEFAULT false,
  tp2_hit BOOLEAN NOT NULL DEFAULT false,
  trailing_stop_active BOOLEAN NOT NULL DEFAULT false,
  stop_loss_price REAL,
  unrealised_pnl_usd REAL NOT NULL DEFAULT 0,
  unrealised_pnl_pct REAL NOT NULL DEFAULT 0,
  realised_pnl_usd REAL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS equity_history (
  id SERIAL PRIMARY KEY,
  equity_usd REAL NOT NULL,
  pnl_usd REAL NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed default rows so the API always has a config/state to return.
INSERT INTO bot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO bot_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO wallet_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
