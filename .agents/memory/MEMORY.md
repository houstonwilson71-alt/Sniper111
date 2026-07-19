# Agent Memory

## Index

- [Replit WebSocket routing](replit-websocket-routing.md) — backend WebSocket path must include the artifact preview-path prefix (e.g., `/api/ws`).
- [Solana wallet adapter dependency gotcha](solana-wallet-adapter-deps.md) — `@solana/wallet-adapter-wallets` pulls Trezor/Coinbase transitive deps that fail in the Replit package firewall; use individual adapters like `@solana/wallet-adapter-phantom` instead.
- [Redis as optional event bus](redis-optional-event-bus.md) — Redis is not available in the Replit container; fall back to HTTP polling and disable aggressive reconnections.
- [Next.js App Router directory precedence](nextjs-app-router-precedence.md) — an empty `app/` at the package root will shadow `src/app/` and cause the entire app to 404.
- [React 19 + wallet adapter peer deps](react19-wallet-peer-deps.md) — Solana wallet-adapter React packages still warn about react-native/bs58 peers but typecheck and run with React 19 if you use the minimal adapter set.

