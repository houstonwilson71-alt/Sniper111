# syntax=docker/dockerfile:1
FROM rust:1.88-slim-bookworm AS builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler perl make build-essential && rm -rf /var/lib/apt/lists/*

# Copy proto files needed by build.rs for code generation.
COPY common/proto ./common/proto

# ── Dependency caching layer ────────────────────────────────────────────────
# Copy Cargo manifests and build.rs before source so that `cargo build`
# compiles all external crates into a cacheable Docker layer.  A stub main.rs
# allows the build to succeed without the real application source.
COPY rust-engine/Cargo.toml rust-engine/Cargo.lock ./rust-engine/
COPY rust-engine/build.rs ./rust-engine/build.rs
RUN mkdir -p ./rust-engine/src && echo 'fn main() {}' > ./rust-engine/src/main.rs
WORKDIR /usr/src/app/rust-engine
RUN cargo build --release || true
# Remove stub binary artifacts so the real build re-links against real source.
RUN rm -f target/release/rust-engine target/release/deps/rust_engine*

# ── Real build ───────────────────────────────────────────────────────────────
WORKDIR /usr/src/app
COPY rust-engine/src ./rust-engine/src
WORKDIR /usr/src/app/rust-engine
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/app/rust-engine/target/release/rust-engine /usr/local/bin/rust-engine
ENTRYPOINT ["rust-engine"]
