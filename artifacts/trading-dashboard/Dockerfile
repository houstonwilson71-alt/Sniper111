# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json tsconfig.json ./
COPY artifacts/trading-dashboard/package.json ./artifacts/trading-dashboard/
COPY lib ./lib
COPY artifacts/trading-dashboard ./artifacts/trading-dashboard

RUN pnpm install --frozen-lockfile

# Build shared lib first (generates dist/ types needed by the dashboard)
RUN pnpm --filter @workspace/common run build

WORKDIR /app/artifacts/trading-dashboard
RUN pnpm run build

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "run", "start"]
