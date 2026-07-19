#!/usr/bin/env bash
set -euo pipefail

# Meme Coin Sniper — local setup script
# This script initializes the database, installs dependencies, and starts the system.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Meme Coin Sniper setup"

# Check for required tools
check_tool() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 is required but not installed. Please install it first."
    exit 1
  fi
}

check_tool pnpm
check_tool docker

# Create env file if missing
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "📝 Creating .env from .env.example..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "⚠️  Edit .env to add your RPC keys, private keys, and set LIVE_TRADING_ENABLED=true only when ready."
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$ROOT_DIR"
pnpm install

# Start Docker infrastructure
echo "🐳 Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

# Wait for postgres
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U sniper -d sniper &>/dev/null; then
    break
  fi
  sleep 1
done

# Export DATABASE_URL for the local dev DB if not already set
export DATABASE_URL="${DATABASE_URL:-postgresql://sniper:sniper@localhost:5432/sniper}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Push DB schema
echo "🗄️  Pushing database schema..."
pnpm --filter @workspace/db run push

# Seed sample data (optional, for dashboard preview)
echo "🌱 Seeding sample data..."
# This is a no-op in the script; seed via the API or run a manual seed file.

echo ""
echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "  1. Edit .env with your real keys and RPC endpoints."
echo "  2. Set LIVE_TRADING_ENABLED=true only when you are ready to trade real funds."
echo "  3. Run the stack:"
echo "     pnpm --filter @workspace/api-server run dev"
echo "     pnpm --filter @workspace/trading-dashboard run dev"
echo "  4. Or start everything in Docker:"
echo "     docker compose up --build"
echo ""
echo "⚠️  WARNING: This system will move real funds when LIVE_TRADING_ENABLED=true."
