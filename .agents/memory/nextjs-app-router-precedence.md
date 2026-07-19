---
name: Next.js App Router directory precedence
description: A stray empty `app/` directory at the project root will shadow `src/app/` and break routing.
---

Next.js 15 detects the App Router by looking for an `app` directory. If both `app/` and `src/app/` exist, the root `app/` takes precedence even if it is empty.

**Rule:** Keep only one App Router root. If using the `src` layout, ensure no empty `app/` directory exists at the package root.

**Why:** An empty `app/` causes Next.js to find zero App Router routes, so it falls back to Pages Router and serves 404 for every page.

**How to apply:**
- After scaffolding, run `find . -maxdepth 1 -type d -name app` and remove any accidental root `app/`.
- Verify `next build` prints `Route (app)` with your expected routes.

