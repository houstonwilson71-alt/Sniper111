# Meme Coin Sniper

Autonomous Solana + BSC meme coin sniper with real-time detection, safety filters, and real on-chain trade execution. This is a production-oriented codebase with Rust listeners/executors, a Node.js API, and a Next.js dashboard.

> ⚠️ When `LIVE_TRADING_ENABLED=true` and real private keys are configured, this system moves real funds. Use a burner wallet and start with tiny amounts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/trading-dashboard run dev` — run the Next.js frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `./setup.sh` — initialize DB, install deps, and start local infrastructure
- `docker compose up --build` — start the full stack in Docker
- Required env: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Next.js 15 (App Router), TailwindCSS 4, shadcn/ui, Recharts, Solana Wallet Adapter, wagmi
- API: Express 5 + WebSocket + Redis Pub/Sub
- DB: PostgreSQL 16 + Drizzle ORM
- Cache/events: Redis 7
- Listeners/executors: Rust (tokio, solana-client, ethers-rs)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Deployment: Docker, Docker Compose

## Where things live

- `artifacts/trading-dashboard` — Next.js frontend pages, wallet providers, UI components
- `artifacts/api-server` — Express routes, WebSocket, DB models, encrypted wallet storage
- `services/listener-solana` / `services/listener-bsc` — Rust pool/pair detection services
- `services/executor-solana` / `services/executor-bsc` — Rust trade execution services
- `lib/db` — Drizzle schema for tokens, positions, trades, equity, config, wallet
- `lib/common` — shared TypeScript types / event-bus contract
- `services/common` — shared Rust types / event constants
- `docker-compose.yml` — full stack orchestration
- `setup.sh` — local initialization script
- `README.md` — full setup and usage instructions

## Architecture decisions

- The Node.js API is the primary backend here because the Replit container lacks a Go compiler. A Go backend is not required for the system to function, but the architecture is documented for easy migration.
- Rust executors refuse to submit any transaction unless `LIVE_TRADING_ENABLED=true` is set in their environment. This is a mandatory safety interlock, not a simulation mode.
- Private keys entered through the dashboard are encrypted with AES-256-GCM when `ENCRYPTION_KEY` is set; otherwise they must be provided via environment variables.
- Redis Pub/Sub is the default event bus for simplicity. NATS can be substituted by changing the publisher/subscriber in the Rust services and Node API.
- The frontend uses Next.js 15 because the workspace already uses React 19, which is officially supported by Next.js 15.

## Product

The dashboard lets a single user:
- Connect a Solana wallet (Phantom) and BSC wallet (MetaMask)
- Configure safety filters and buy/sell strategy
- Start/stop the bot and trigger an emergency stop
- View live token detections, open positions, trade history, and equity curve
- Receive real-time updates via WebSocket

## User preferences

- User confirmed they want a real-money autonomous trading bot with mandatory safety interlocks (env-gated live trading, no plaintext keys, emergency stop).
- User chose to replace the existing React Vite dashboard with a Next.js frontend.

## Gotchas

- The Rust services cannot be compiled inside the Replit container (no Rust toolchain). Use Docker or a local Rust 1.85+ installation to build them.
- `LIVE_TRADING_ENABLED` must be set consistently across the API and all executor services or no real transactions will be submitted.
- After changing the Drizzle schema, run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` so stale type declarations are regenerated.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `README.md` for full deployment and wallet setup instructions
