---
name: Solana wallet adapter dependency gotcha
description: Avoid the umbrella wallets package in Replit; use individual adapter packages to dodge package-firewall failures.
---

`@solana/wallet-adapter-wallets` bundles many adapters including Trezor, which depends on `@trezor/protobuf` and `@coinbase/cdp-sdk`. These transitive dependencies trigger 403/Forbidden errors from the Replit package firewall during `pnpm install`.

**Rule:** Install only the specific adapters you need, e.g., `@solana/wallet-adapter-phantom` for Phantom support.

**Why:** The umbrella package's transitive dependency tree includes packages that the Replit package firewall blocks or that cannot resolve optional peer dependencies.

**How to apply:**
- Remove `@solana/wallet-adapter-wallets` from `package.json`.
- Import `PhantomWalletAdapter` from `@solana/wallet-adapter-phantom`.
- Keep `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, and `@solana/wallet-adapter-base`.

