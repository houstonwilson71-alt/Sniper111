# syntax=docker/dockerfile:1
FROM node:24 AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# ── Step 1: copy workspace manifests (all package.json + workspace config)
# This preserves layer caching: changes to sources don't bust the install layer.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json tsconfig.json ./

# All workspace package.json files must be present so pnpm frozen-lockfile resolves correctly.
COPY artifacts/api-server/package.json          ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json      ./artifacts/mockup-sandbox/
COPY artifacts/trading-dashboard/package.json   ./artifacts/trading-dashboard/
COPY lib/api-client-react/package.json          ./lib/api-client-react/
COPY lib/api-spec/package.json                  ./lib/api-spec/
COPY lib/api-zod/package.json                   ./lib/api-zod/
COPY lib/common/package.json                    ./lib/common/
COPY lib/db/package.json                        ./lib/db/
COPY scripts/package.json                       ./scripts/

RUN pnpm install --frozen-lockfile

# ── Step 2: copy sources only for the packages we need to build
COPY lib ./lib
COPY artifacts/trading-dashboard ./artifacts/trading-dashboard

# Build shared lib first (generates dist/ types needed by the dashboard)
RUN pnpm --filter @workspace/common run build

WORKDIR /app/artifacts/trading-dashboard
RUN pnpm run build

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "run", "start"]
