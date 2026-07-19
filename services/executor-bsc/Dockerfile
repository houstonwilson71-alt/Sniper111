# syntax=docker/dockerfile:1
FROM rust:1.85-slim-bullseye AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY services/common ./services/common
COPY services/executor-bsc ./services/executor-bsc
COPY Cargo.toml ./
WORKDIR /usr/src/app/services/executor-bsc
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/app/target/release/executor-bsc /usr/local/bin/executor-bsc
ENTRYPOINT ["executor-bsc"]
