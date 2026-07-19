# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm install --frozen-lockfile

WORKDIR /app/artifacts/api-server
RUN pnpm run build

EXPOSE 5000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
