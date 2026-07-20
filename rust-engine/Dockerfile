# syntax=docker/dockerfile:1
FROM rust:1.85-slim-bullseye AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler && rm -rf /var/lib/apt/lists/*
COPY common/proto ./common/proto
COPY rust-engine ./rust-engine
WORKDIR /usr/src/app/rust-engine
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/app/rust-engine/target/release/rust-engine /usr/local/bin/rust-engine
ENTRYPOINT ["rust-engine"]
