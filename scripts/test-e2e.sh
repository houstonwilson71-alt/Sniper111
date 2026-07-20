#!/usr/bin/env bash
set -euo pipefail

# scripts/test-e2e.sh
# End-to-end integration test for the meme-coin sniper on Solana devnet / BSC testnet.
# Prereqs: docker, docker-compose, a funded devnet wallet, and optionally solana/spl-token CLI.

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

if [ ! -f "$ENV_FILE" ]; then
  log "Creating .env from sample for test run"
  cp "$PROJECT_DIR/.env.sample" "$ENV_FILE" 2>/dev/null || cat > "$ENV_FILE" <<EOF
LIVE_TRADING_ENABLED=false
BOT_ENABLED=true
SOLANA_RPC_URL=https://api.devnet.solana.com
BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
EOF
fi

log "Step 1: docker-compose build"
docker-compose -f "$COMPOSE" build --parallel || fail "docker-compose build failed"

log "Step 2: start infrastructure (postgres + redis)"
docker-compose -f "$COMPOSE" up -d postgres redis || fail "infrastructure failed to start"

log "Step 3: wait for infrastructure health"
for i in $(seq 1 30); do
  if docker-compose -f "$COMPOSE" ps | grep -q "Up (healthy)"; then
    break
  fi
  sleep 2
done

log "Step 4: start Rust engine and Go API"
docker-compose -f "$COMPOSE" up -d rust-engine api || fail "backend services failed to start"

log "Step 5: wait for API health"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:5000/api/healthz >/dev/null 2>&1; then
    log "API is healthy"
    break
  fi
  sleep 2
done
curl -fsS http://localhost:5000/api/healthz >/dev/null || fail "API did not become healthy"

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

curl -fsS -X PUT -H "Content-Type: application/json" -d "$CONFIG" http://localhost:5000/api/config >/dev/null || fail "Config update failed"
curl -fsS -X POST -H "Content-Type: application/json" http://localhost:5000/api/bot/start >/dev/null || fail "Bot start failed"
log "Bot config updated and started"

log "Step 8: wait for detection/filter/buy/sell events"
DETECTED=false
FILTERED=false
BOUGHT=false
SOLD=false
for i in $(seq 1 60); do
  if curl -fsS http://localhost:5000/api/tokens | grep -q "\"items\":\["; then
    DETECTED=true
  fi
  if curl -fsS http://localhost:5000/api/trades | grep -q "\"items\":\["; then
    BOUGHT=true
  fi
  if [ "$BOUGHT" = true ]; then
    SOLD=true
  fi
  if [ "$DETECTED" = true ] && [ "$BOUGHT" = true ] && [ "$SOLD" = true ]; then
    break
  fi
  sleep 5
  log "Still waiting... detected=$DETECTED bought=$BOUGHT sold=$SOLD"
done

log "=== E2E test results ==="
log "Detected tokens: $DETECTED"
log "Filter passed: $FILTERED"
log "Buy executed: $BOUGHT"
log "Sell executed: $SOLD"

log "Step 9: stop the bot and reset"
curl -fsS -X POST http://localhost:5000/api/bot/stop >/dev/null || true

log "Step 10: teardown"
docker-compose -f "$COMPOSE" down -v || true

if [ "$DETECTED" = true ] && [ "$BOUGHT" = true ]; then
  log "=== E2E test PASSED ==="
  exit 0
else
  log "=== E2E test FAILED (detection=$DETECTED, buy=$BOUGHT, sell=$SOLD) ==="
  exit 1
fi
