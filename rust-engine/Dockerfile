# syntax=docker/dockerfile:1
FROM rust:1.88-slim-bookworm AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler perl make build-essential && rm -rf /var/lib/apt/lists/*

# Copy proto files needed by build.rs for code generation.
COPY common/proto ./common/proto

# Copy Cargo manifests and build script
COPY rust-engine/Cargo.toml rust-engine/Cargo.lock ./rust-engine/
COPY rust-engine/build.rs ./rust-engine/build.rs
COPY rust-engine/src ./rust-engine/src

WORKDIR /usr/src/app/rust-engine

# Build with persistent cache mounts so cargo downloads/compiled deps survive
# across interrupted or repeated builds (critical for long Rust compile times).
# The final binary is copied out of the cache-mounted target dir before it ends.
RUN --mount=type=cache,target=/root/.cargo/registry \
    --mount=type=cache,target=/root/.cargo/git \
    --mount=type=cache,target=/usr/src/app/rust-engine/target \
    cargo build --release && \
    cp target/release/rust-engine /usr/src/rust-engine-bin

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/rust-engine-bin /usr/local/bin/rust-engine
ENTRYPOINT ["rust-engine"]
