---
name: React 19 + wallet adapter peer deps
description: Solana wallet-adapter React packages warn about react-native peers but work with React 19 if you keep the adapter set minimal.
---

The Solana wallet adapter React packages declare peer dependencies on `react-native` and older `bs58` versions, which `pnpm` flags as warnings. With React 19, this can be alarming but does not block typecheck or runtime for the minimal adapter set.

**Rule:** Don't add `react-native` to the frontend just to silence peer warnings; use the individual adapters and ignore the warnings if the app builds and runs.

**Why:** The umbrella `@solana/wallet-adapter-wallets` package is the real source of install/build failures; the minimal adapter set is compatible with React 19 in practice.

**How to apply:**
- Use `@solana/wallet-adapter-phantom` and the core React UI packages only.
- Run `pnpm run build` to confirm runtime compatibility; treat warnings as non-blocking unless the build fails.

