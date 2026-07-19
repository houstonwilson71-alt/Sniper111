# Meme Coin Sniper — Autonomous Trading System

A production-oriented, real-money meme coin sniper and dashboard for **Solana** and **BNB Smart Chain**. It detects new pools, applies configurable safety filters, and executes real on-chain buys and sells automatically.

> ⚠️ **WARNING**: This system is designed to move real funds when `LIVE_TRADING_ENABLED=true` and real private keys/RPCs are configured. It is not a simulation. Start with a small burner wallet and never trade more than you can afford to lose.

---

## Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Next.js UI    │◄────►│  Node.js API │◄────►│  PostgreSQL +    │
│  (wallet conn)  │      │  (REST + WS) │      │  Redis           │
└─────────────────┘      └──────┬───────┘      └──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼────────┐┌──────▼──────┐┌────────▼────────┐
     │ listener-solana ││ listener-bsc││  Redis Pub/Sub  │
     │   (Rust + gRPC) ││  (Rust + WS)││                 │
     └────────┬────────┘└──────┬──────┘└─────────────────┘
              │                │
     ┌────────▼────────┐┌──────▼──────┐
     │ executor-solana ││ executor-bsc│
     │  (Rust + Jito)  ││(Rust + PCS) │
     └─────────────────┘└─────────────┘
```

### Repos layout

| Folder | Purpose |
|--------|---------|
| `artifacts/trading-dashboard` | Next.js 15 App Router frontend, wallet adapters, dashboard |
| `artifacts/api-server` | Node.js/Express API, DB access, WebSocket fan-out, safety interlocks |
| `services/listener-solana` | Rust service: detects new Solana pools via RPC/gRPC (Helius/Yellowstone) |
| `services/listener-bsc` | Rust service: detects new PancakeSwap pairs via BSC WebSocket |
| `services/executor-solana` | Rust service: Jupiter swap + Jito bundle execution |
| `services/executor-bsc` | Rust service: PancakeSwap router execution (optionally BloxRoute) |
| `lib/common` | Shared TypeScript types and event-bus contract |
| `services/common` | Shared Rust types and event constants |
| `lib/db` | Drizzle ORM PostgreSQL schema |

---

## Quick start (local)

### 1. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [pnpm](https://pnpm.io/installation) 10+
- (Optional) Rust 1.85+ and Go 1.23+ if you want to run the Rust services natively outside Docker

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your RPC keys, private keys, and set a strong ENCRYPTION_KEY.
# Leave LIVE_TRADING_ENABLED=false while testing.
```

### 3. Run the setup script

```bash
chmod +x setup.sh
./setup.sh
```

This starts PostgreSQL and Redis, installs dependencies, and pushes the DB schema.

### 4. Start the services

Terminal 1 — API + WebSocket:

```bash
pnpm --filter @workspace/api-server run dev
```

Terminal 2 — frontend:

```bash
pnpm --filter @workspace/trading-dashboard run dev
```

Terminal 3+ — Rust listeners/executors (in Docker, or build natively with `cargo run`):

```bash
docker compose up -d listener-solana listener-bsc executor-solana executor-bsc
```

The dashboard is available at `http://localhost:3000`. The API is at `http://localhost:5000`.

---

## Full Docker deployment

```bash
docker compose up --build
```

This builds and starts the API, frontend, PostgreSQL, Redis, and all Rust services. You still need to provide a valid `.env` with real RPC keys and private keys for live trading.

---

## Live trading safety rules

1. `LIVE_TRADING_ENABLED=true` must be set in the environment of **both** the API and the Rust executors. Without this, the executors will refuse to sign or submit any transaction.
2. Private keys must be supplied via environment variables (`SOLANA_PRIVATE_KEY`, `BSC_PRIVATE_KEY`) or stored encrypted in the database when `ENCRYPTION_KEY` is set.
3. The dashboard has an **Emergency Stop** button that immediately sets the bot state to `emergencyStopped=true`. The bot cannot be restarted until the stop is reset.
4. The dashboard never starts live trading by itself. It only changes the bot `running` flag. Real transaction submission is gated by the executor-side `LIVE_TRADING_ENABLED` env var.
5. Always test with a fresh burner wallet and small amounts first.

---

## Wallet configuration

- **Solana**: Connect with Phantom via the Solana Wallet Adapter, or paste a base58 private key.
- **BSC**: Connect with MetaMask via `wagmi`, or paste a hex private key.
- Private keys entered in the dashboard are stored **encrypted** in PostgreSQL when `ENCRYPTION_KEY` is set. If `ENCRYPTION_KEY` is not set, the dashboard falls back to environment variables and will not persist plaintext keys.

---

## Strategy defaults

| Parameter | Default |
|-----------|---------|
| Min liquidity | $5,000 |
| Max token age | 300 s |
| Min holders | 25 |
| Max top-10 concentration | 35% |
| Max rug score | 2 / 10 |
| Buy amount (Solana) | 0.01 SOL |
| Buy amount (BSC) | 0.01 BNB |
| Slippage | 15% |
| TP1 | +100% → sell 50% |
| Trailing stop | 25% below peak after TP1 |
| Time exit | 120 min if profit < 20% |

---

## Real integrations still to wire

The scaffolding is complete and the system will run. The following are the last-mile connections you must add with your own API keys before live trading:

- **Solana pool detection**: Replace the Helius polling fallback with a Yellowstone gRPC or Helius webhook subscription.
- **BSC pair detection**: Replace the polling fallback with a real WebSocket `logs` subscription to the PancakeSwap factory.
- **Solana execution**: Wire the Jupiter quote/swap API and Jito bundle RPC in `services/executor-solana/src/main.rs`.
- **BSC execution**: Wire the PancakeSwap router ABI and BloxRoute private-tx endpoint in `services/executor-bsc/src/main.rs`.
- **Honeypot detection**: Add a BSC `eth_call` simulation step before emitting buy signals.

These are intentionally left as explicit TODOs guarded by the live-trading interlock so the system cannot silently trade real money with placeholder code.

---

## License

MIT. Use at your own risk. This is experimental financial software.
