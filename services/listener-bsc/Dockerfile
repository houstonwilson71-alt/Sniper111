# syntax=docker/dockerfile:1
FROM rust:1.85-slim-bullseye AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY services/common ./services/common
COPY services/listener-bsc ./services/listener-bsc
COPY Cargo.toml ./
WORKDIR /usr/src/app/services/listener-bsc
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/app/target/release/listener-bsc /usr/local/bin/listener-bsc
ENTRYPOINT ["listener-bsc"]
