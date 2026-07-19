# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY artifacts/trading-dashboard/package.json ./artifacts/trading-dashboard/
COPY lib ./lib
COPY artifacts/trading-dashboard ./artifacts/trading-dashboard

RUN pnpm install --frozen-lockfile

WORKDIR /app/artifacts/trading-dashboard
RUN pnpm run build

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "run", "start"]
