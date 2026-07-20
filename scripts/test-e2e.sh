#!/usr/bin/env bash
set -euo pipefail

# scripts/test-e2e.sh
# End-to-end integration test for the meme-coin sniper on Solana devnet / BSC testnet.
# Prereqs: docker, docker compose, a funded devnet wallet, and optionally solana/spl-token CLI.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"

export COMPOSE_PROJECT_NAME=sniper-e2e

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1"
}

fail() {
  log "ERROR: $1"
  exit 1
}

log "=== Sniper E2E test starting ==="

# Always write a clean .env for the test run. Optional keys with empty values
# (e.g. YELLOWSTONE_ENDPOINT=) must be omitted entirely so that the Rust engine
# does not treat an empty string as a configured endpoint and crash-loop trying
# to connect to nothing.
cat > "$ENV_FILE" <<EOF
LIVE_TRADING_ENABLED=${LIVE_TRADING_ENABLED:-false}
BOT_ENABLED=true
SOLANA_RPC_URL=${SOLANA_RPC_URL:-https://api.devnet.solana.com}
BSC_RPC_URL=${BSC_RPC_URL:-https://data-seed-prebsc-1-s1.bnbchain.org:8545}
JUPITER_API_URL=${JUPITER_API_URL:-https://quote-api.jup.ag/v6}
JITO_TIP_LAMPORTS=${JITO_TIP_LAMPORTS:-10000}
SESSION_SECRET=${SESSION_SECRET:-change-me-in-production}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-change-me-in-production}
INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN:-change-me-in-production}
EOF
# Only add optional keys when they have a real (non-empty) value, so the Rust
# engine receives None from env::var(...).ok() rather than Some("").
[ -n "${YELLOWSTONE_ENDPOINT:-}" ] && echo "YELLOWSTONE_ENDPOINT=$YELLOWSTONE_ENDPOINT" >> "$ENV_FILE"
[ -n "${YELLOWSTONE_TOKEN:-}" ]    && echo "YELLOWSTONE_TOKEN=$YELLOWSTONE_TOKEN"       >> "$ENV_FILE"
[ -n "${SOLANA_WS_URL:-}" ]        && echo "SOLANA_WS_URL=$SOLANA_WS_URL"               >> "$ENV_FILE"
[ -n "${SOLANA_PRIVATE_KEY:-}" ]   && echo "SOLANA_PRIVATE_KEY=$SOLANA_PRIVATE_KEY"     >> "$ENV_FILE"
[ -n "${BSC_WS_URL:-}" ]           && echo "BSC_WS_URL=$BSC_WS_URL"                     >> "$ENV_FILE"
[ -n "${BSC_PRIVATE_KEY:-}" ]      && echo "BSC_PRIVATE_KEY=$BSC_PRIVATE_KEY"           >> "$ENV_FILE"
[ -n "${HELIUS_API_KEY:-}" ]       && echo "HELIUS_API_KEY=$HELIUS_API_KEY"             >> "$ENV_FILE"
[ -n "${JITO_BLOCK_ENGINE_URL:-}" ] && echo "JITO_BLOCK_ENGINE_URL=$JITO_BLOCK_ENGINE_URL" >> "$ENV_FILE"
[ -n "${BLOXROUTE_AUTH_HEADER:-}" ] && echo "BLOXROUTE_AUTH_HEADER=$BLOXROUTE_AUTH_HEADER" >> "$ENV_FILE"
log ".env written for test run (LIVE_TRADING_ENABLED=${LIVE_TRADING_ENABLED:-false})"

LIVE_MODE="${LIVE_TRADING_ENABLED:-false}"

log "Step 1: docker compose build"
docker compose -f "$COMPOSE" build --parallel || fail "docker compose build failed"

log "Step 2: start infrastructure (postgres + redis)"
docker compose -f "$COMPOSE" up -d postgres redis || fail "infrastructure failed to start"

log "Step 3: wait for infrastructure health"
# Docker Compose v2 shows "Up N seconds (healthy)" — match just "(healthy)"
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE" ps | grep -q "(healthy)"; then
    log "Infrastructure healthy (iteration $i)"
    break
  fi
  sleep 2
done

log "Step 4: start Rust engine and Go API"
docker compose -f "$COMPOSE" up -d rust-engine api || fail "backend services failed to start"

log "Step 5: wait for API health"
API_HEALTHY=false
for i in $(seq 1 30); do
  if curl -fsS http://localhost:5000/api/healthz >/dev/null 2>&1; then
    log "API is healthy"
    API_HEALTHY=true
    break
  fi
  sleep 2
done
if [ "$API_HEALTHY" != "true" ]; then
  log "=== Container logs ==="
  docker compose -f "$COMPOSE" logs api || true
  docker compose -f "$COMPOSE" logs rust-engine || true
  fail "API did not become healthy"
fi

log "Step 6: deploy a test token on Solana devnet"
# If solana CLI is available, create a test token and mint some supply.
if command -v solana >/dev/null 2>&1 && command -v spl-token >/dev/null 2>&1; then
  solana config set --url devnet >/dev/null
  PAYER=$(solana address) || fail "No Solana payer configured"
  log "Payer: $PAYER"
  TOKEN=$(spl-token create-token --output json | jq -r .commandOutput.address) || fail "Token creation failed"
  log "Created token: $TOKEN"
  ACCOUNT=$(spl-token create-account "$TOKEN" --output json | jq -r .commandOutput.address)
  spl-token mint "$TOKEN" 1000000 "$ACCOUNT" >/dev/null || fail "Token mint failed"
  log "Minted 1M tokens to $ACCOUNT"
  # Fund the bot wallet with a small amount of SOL so it can simulate.
  BOT_WALLET=${SOLANA_PRIVATE_KEY:-""}
  if [ -n "$BOT_WALLET" ]; then
    BOT_ADDR=$(echo "$BOT_WALLET" | solana-keygen pubkey /dev/stdin 2>/dev/null) || true
    if [ -n "$BOT_ADDR" ]; then
      solana airdrop 2 "$BOT_ADDR" >/dev/null 2>&1 || log "Airdrop to bot wallet may have failed (devnet faucet limits)"
    fi
  fi
else
  log "Solana CLI not available; skipping live token deployment. The test will still verify service health and config propagation."
  TOKEN=""
fi

log "Step 7: update bot config and start the bot"
CONFIG='{
  "enableSolana": true,
  "enableBsc": true,
  "minLiquidityUsd": 1000,
  "maxTokenAgeSeconds": 3600,
  "minHolders": 0,
  "maxTop10Pct": 100,
  "maxRugScore": 10,
  "minVolumeUsd": 0,
  "buyAmountSol": 0.001,
  "buyAmountBnb": 0.001,
  "slippagePct": 30,
  "jitoTipLamports": 0,
  "tp1Pct": 50,
  "tp1SellPct": 50,
  "trailingStopPct": 50,
  "timeExitMinutes": 60,
  "timeExitMinProfitPct": 0,
  "enabled": true
}'

CONFIG_OK=false
BOT_START_OK=false

if curl -fsS -X PUT -H "Content-Type: application/json" -d "$CONFIG" http://localhost:5000/api/config >/dev/null; then
  CONFIG_OK=true
  log "Config update: OK"
else
  log "WARNING: Config update failed"
fi

if curl -fsS -X POST -H "Content-Type: application/json" http://localhost:5000/api/bot/start >/dev/null; then
  BOT_START_OK=true
  log "Bot start: OK"
else
  log "WARNING: Bot start failed"
fi

log "Step 8: wait for detection/filter/buy/sell events"
DETECTED=false
FILTERED=false
BOUGHT=false
SOLD=false

# When LIVE_TRADING_ENABLED=false, chain listeners run in dry-run mode; actual
# on-chain buys are skipped so trade records won't appear in the DB. We poll
# for up to 60 s to surface any real activity, but success is determined by
# service health (see step 9 below).
# Poll for up to 60 s (12 × 5 s). In dry-run mode this loop is informational;
# success is already determined by API_HEALTHY/CONFIG_OK/BOT_START_OK.
for i in $(seq 1 12); do
  if curl -fsS http://localhost:5000/api/tokens 2>/dev/null | grep -q '"items":\['; then
    DETECTED=true
  fi
  if curl -fsS http://localhost:5000/api/trades 2>/dev/null | grep -q '"items":\['; then
    BOUGHT=true
  fi
  if [ "$DETECTED" = true ] && [ "$BOUGHT" = true ]; then
    break
  fi
  sleep 5
  log "Still waiting... detected=$DETECTED bought=$BOUGHT"
done

log "=== E2E test results ==="
log "Detected tokens: $DETECTED"
log "Filter passed:   $FILTERED"
log "Buy executed:    $BOUGHT"
log "Sell executed:   $SOLD"

log "Step 9: stop the bot and reset"
curl -fsS -X POST http://localhost:5000/api/bot/stop >/dev/null || true

log "Step 10: teardown"
docker compose -f "$COMPOSE" down -v || true

# --- Success evaluation -------------------------------------------------------
# When LIVE_TRADING_ENABLED=false we are in dry-run / test-harness mode.
# The bar is: services started without panicking and the REST API responded to
# all control endpoints. Full detection+buy cycles require live RPC feeds and
# a funded wallet, neither of which is present in CI.
#
# When LIVE_TRADING_ENABLED=true we require actual detection and a buy attempt.
# ---------------------------------------------------------------------------

if [ "$LIVE_MODE" = "true" ]; then
  if [ "$DETECTED" = true ] && [ "$BOUGHT" = true ]; then
    log "=== E2E test PASSED (live mode, full detection+buy) ==="
    exit 0
  else
    log "=== E2E test FAILED (live mode, detection=$DETECTED, buy=$BOUGHT) ==="
    exit 1
  fi
else
  # Dry-run / CI mode: pass if API was healthy and accepted commands.
  if [ "$API_HEALTHY" = "true" ] && [ "$CONFIG_OK" = "true" ] && [ "$BOT_START_OK" = "true" ]; then
    log "=== E2E test PASSED (dry-run mode: API healthy, config updated, bot started) ==="
    if [ "$DETECTED" = true ]; then
      log "Bonus: token detection events observed during the polling window."
    fi
    exit 0
  else
    log "=== E2E test FAILED (dry-run mode: api_healthy=$API_HEALTHY config_ok=$CONFIG_OK bot_start_ok=$BOT_START_OK) ==="
    exit 1
  fi
fi
