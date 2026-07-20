use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tokio_stream::{wrappers::ReceiverStream, Stream, StreamExt};
use tonic::{transport::Server, Request, Response, Status, Streaming};
use tracing::{info, error};

use crate::config::EngineConfig;
use crate::types::{Command, EngineEvent, Token};

pub mod proto {
    tonic::include_proto!("engine");
}

use proto::{
    engine_server::{Engine, EngineServer},
    BotConfig as ProtoConfig, ControlCommand, EngineCommand, EngineEvent as ProtoEvent,
    LogMessage, TokenDetected,
};

pub struct EngineGrpcServer {
    cmd_tx: mpsc::Sender<Command>,
    event_rx: Arc<Mutex<mpsc::Receiver<EngineEvent>>>,
}

impl EngineGrpcServer {
    pub fn new(cmd_tx: mpsc::Sender<Command>, event_rx: mpsc::Receiver<EngineEvent>) -> Self {
        Self {
            cmd_tx,
            event_rx: Arc::new(Mutex::new(event_rx)),
        }
    }

    pub async fn serve(self, addr: std::net::SocketAddr) -> Result<(), Box<dyn std::error::Error>> {
        info!("Starting gRPC server on {}", addr);
        Server::builder()
            .add_service(EngineServer::new(self))
            .serve(addr)
            .await?;
        Ok(())
    }
}

#[tonic::async_trait]
impl Engine for EngineGrpcServer {
    type ConnectStream = Pin<Box<dyn Stream<Item = Result<ProtoEvent, Status>> + Send>>;

    async fn connect(
        &self,
        request: Request<Streaming<EngineCommand>>,
    ) -> Result<Response<Self::ConnectStream>, Status> {
        info!("Go backend connected via gRPC");
        let mut incoming = request.into_inner();
        let cmd_tx = self.cmd_tx.clone();
        let event_rx = self.event_rx.clone();

        // Spawn command handler
        tokio::spawn(async move {
            while let Some(cmd) = incoming.next().await {
                match cmd {
                    Ok(cmd) => {
                        if let Some(c) = convert_command(cmd) {
                            let _ = cmd_tx.send(c).await;
                        }
                    }
                    Err(e) => error!("gRPC command error: {}", e),
                }
            }
        });

        // Stream events back to Go backend
        let rx = event_rx.lock().await;
        let stream = ReceiverStream::new(rx).map(|event| Ok(convert_event(event)));
        Ok(Response::new(Box::pin(stream)))
    }
}

fn convert_command(cmd: EngineCommand) -> Option<Command> {
    use proto::engine_command::Payload;
    match cmd.payload? {
        Payload::Config(cfg) => {
            let mut engine_cfg = EngineConfig::from_env();
            engine_cfg.live_trading_enabled = cfg.enabled && std::env::var("LIVE_TRADING_ENABLED").unwrap_or_default() == "true";
            Some(Command::UpdateConfig(engine_cfg))
        }
        Payload::Control(ctrl) => match ctrl.action() {
            proto::control_command::Action::Start => Some(Command::Start),
            proto::control_command::Action::Stop => Some(Command::Stop),
            proto::control_command::Action::EmergencyStop => Some(Command::EmergencyStop(ctrl.reason)),
            proto::control_command::Action::ResetEmergency => Some(Command::ResetEmergency),
        },
    }
}

fn convert_event(event: EngineEvent) -> ProtoEvent {
    let mut out = ProtoEvent::default();
    match event {
        EngineEvent::TokenDetected(t) => {
            out.payload = Some(proto::engine_event::Payload::TokenDetected(TokenDetected {
                id: t.id,
                chain: t.chain,
                address: t.address,
                symbol: t.symbol,
                name: t.name,
                liquidity_usd: t.liquidity_usd,
                holders: t.holders,
                age_seconds: t.age_seconds,
                top10_pct: t.top10_pct,
                rug_score: t.rug_score,
                volume_usd: t.volume_usd,
                price_usd: t.price_usd,
                filter_passed: t.filter_passed,
                fail_reasons: t.fail_reasons,
                detected_at: t.detected_at,
                pool_address: t.pool_address,
                mint_authority_revoked: t.mint_authority_revoked,
                freeze_authority_revoked: t.freeze_authority_revoked,
                honeypot: t.honeypot,
                buy_tax_pct: t.buy_tax_pct,
                sell_tax_pct: t.sell_tax_pct,
            }));
        }
        EngineEvent::Log { level, message } => {
            out.payload = Some(proto::engine_event::Payload::Log(LogMessage {
                level,
                message,
                timestamp: chrono::Utc::now().to_rfc3339(),
            }));
        }
        _ => {
            // Other events serialized as log for simplicity in this iteration.
            out.payload = Some(proto::engine_event::Payload::Log(LogMessage {
                level: "info".to_string(),
                message: serde_json::to_string(&event).unwrap_or_default(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            }));
        }
    }
    out
}

pub fn convert_proto_config(_cfg: &ProtoConfig) -> EngineConfig {
    EngineConfig::from_env()
}

pub fn build_token_from_proto(t: TokenDetected) -> Token {
    Token {
        id: t.id,
        chain: t.chain,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        liquidity_usd: t.liquidity_usd,
        holders: t.holders,
        age_seconds: t.age_seconds,
        top10_pct: t.top10_pct,
        rug_score: t.rug_score,
        volume_usd: t.volume_usd,
        price_usd: t.price_usd,
        filter_passed: t.filter_passed,
        fail_reasons: t.fail_reasons,
        detected_at: t.detected_at,
        pool_address: t.pool_address,
        mint_authority_revoked: t.mint_authority_revoked,
        freeze_authority_revoked: t.freeze_authority_revoked,
        honeypot: t.honeypot,
        buy_tax_pct: t.buy_tax_pct,
        sell_tax_pct: t.sell_tax_pct,
    }
}
