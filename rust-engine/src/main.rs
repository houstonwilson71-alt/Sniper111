use anyhow::Result;
use tokio::sync::mpsc;
use tracing::{info, error};

mod config;
mod executor_bsc;
mod executor_solana;
mod filter;
mod grpc;
mod listener_bsc;
mod listener_solana;
mod position_monitor;
mod safety;
mod types;

use config::EngineConfig;
use grpc::EngineGrpcServer;
use types::{Command, EngineEvent};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("info,rust_engine=debug"))
        .init();

    let cfg = EngineConfig::from_env();
    info!("Rust engine starting... live={} grpc={}", cfg.live_trading_enabled, cfg.grpc_addr);

    let (event_tx, event_rx) = mpsc::channel::<EngineEvent>(1024);
    let (cmd_tx, cmd_rx) = mpsc::channel::<Command>(128);

    // Start gRPC server so the Go backend can connect and stream commands/events.
    let grpc_server = EngineGrpcServer::new(cmd_tx, event_rx);
    let grpc_addr = cfg.grpc_addr.parse().unwrap_or_else(|_| "0.0.0.0:50051".parse().unwrap());
    let grpc_handle = tokio::spawn(async move {
        if let Err(e) = grpc_server.serve(grpc_addr).await {
            error!("gRPC server error: {}", e);
        }
    });

    // Start chain listeners and executors.
    let sol_handle = tokio::spawn(listener_solana::run(cfg.clone(), event_tx.clone()));
    let bsc_handle = tokio::spawn(listener_bsc::run(cfg.clone(), event_tx.clone()));
    // Executor solana gets its own command channel (commands are optional; gRPC drives via grpc cmd_rx → position_monitor).
    let (_, sol_cmd_rx) = mpsc::channel::<Command>(1);
    let sol_exec = tokio::spawn(executor_solana::run(cfg.clone(), event_tx.clone(), sol_cmd_rx));
    let bsc_exec = tokio::spawn(executor_bsc::run(cfg.clone(), event_tx.clone()));
    let pos_monitor = tokio::spawn(position_monitor::run(cfg.clone(), event_tx.clone(), cmd_rx));

    // Safety filter loop: receives detected tokens, runs checks, emits buy signals.
    let filter_handle = tokio::spawn(filter::run(cfg.clone(), event_tx.clone()));

    tokio::select! {
        _ = grpc_handle => {},
        _ = sol_handle => {},
        _ = bsc_handle => {},
        _ = sol_exec => {},
        _ = bsc_exec => {},
        _ = pos_monitor => {},
        _ = filter_handle => {},
    }

    Ok(())
}
