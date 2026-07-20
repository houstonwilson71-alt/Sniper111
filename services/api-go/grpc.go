// services/api-go/grpc.go
// gRPC bridge between the Go dashboard API and the Rust engine.
// The Rust engine exposes the Engine service (bidirectional streaming).
// The Go backend is the client: it sends BotConfig/Control commands and
// receives TokenDetected, TradeUpdate, PositionUpdate and Log events.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/houstonwilson71-alt/sniper111/common/proto/engine"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type engineBridge struct {
	client     engine.EngineClient
	stream     engine.Engine_ConnectClient
	wss        *webSocketHub
	db         *DB
	lastConfig BotConfig
}

func mustInitEngineBridge(wss *webSocketHub, db *DB) *engineBridge {
	addr := os.Getenv("ENGINE_GRPC_ADDR")
	if addr == "" {
		addr = "rust-engine:50051"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, addr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		log.Printf("WARN: could not connect to Rust engine gRPC at %s: %v. Dashboard will show local DB state only.", addr, err)
		return &engineBridge{wss: wss, db: db}
	}

	client := engine.NewEngineClient(conn)
	stream, err := client.Connect(context.Background())
	if err != nil {
		log.Printf("WARN: could not open engine stream: %v", err)
		return &engineBridge{wss: wss, db: db}
	}

	bridge := &engineBridge{
		client: client,
		stream: stream,
		wss:    wss,
		db:     db,
	}

	// Send the current config once at startup.
	cfg, _ := db.GetConfig()
	bridge.sendConfig(cfg)

	// Receive events from the Rust engine and fan out to WebSocket clients.
	go bridge.receiveLoop()

	return bridge
}

func (b *engineBridge) sendConfig(cfg BotConfig) {
	if b.stream == nil {
		return
	}
	b.lastConfig = cfg
	msg := &engine.EngineCommand{
		Payload: &engine.EngineCommand_Config{
			Config: &engine.BotConfig{
				EnableSolana:         cfg.EnableSolana,
				EnableBsc:            cfg.EnableBsc,
				MinLiquidityUsd:      cfg.MinLiquidityUsd,
				MaxTokenAgeSeconds:   int32(cfg.MaxTokenAgeSeconds),
				MinHolders:           int32(cfg.MinHolders),
				MaxTop10Pct:          cfg.MaxTop10Pct,
				MaxRugScore:          cfg.MaxRugScore,
				MinVolumeUsd:         cfg.MinVolumeUsd,
				BuyAmountSol:         cfg.BuyAmountSol,
				BuyAmountBnb:         cfg.BuyAmountBnb,
				SlippagePct:          cfg.SlippagePct,
				JitoTipLamports:      cfg.JitoTipLamports,
				Tp1Pct:               cfg.Tp1Pct,
				Tp1SellPct:           cfg.Tp1SellPct,
				TrailingStopPct:      cfg.TrailingStopPct,
				TimeExitMinutes:      int32(cfg.TimeExitMinutes),
				TimeExitMinProfitPct: cfg.TimeExitMinProfitPct,
				Enabled:              cfg.Enabled,
			},
		},
	}
	if err := b.stream.Send(msg); err != nil {
		log.Printf("engine sendConfig failed: %v", err)
	}
}

func (b *engineBridge) sendControl(action engine.ControlCommand_Action, reason string) {
	if b.stream == nil {
		return
	}
	msg := &engine.EngineCommand{
		Payload: &engine.EngineCommand_Control{
			Control: &engine.ControlCommand{
				Action: action,
				Reason: reason,
			},
		},
	}
	if err := b.stream.Send(msg); err != nil {
		log.Printf("engine sendControl failed: %v", err)
	}
}

func (b *engineBridge) receiveLoop() {
	if b.stream == nil {
		return
	}
	for {
		incoming, err := b.stream.Recv()
		if err == io.EOF {
			log.Println("engine stream closed")
			return
		}
		if err != nil {
			log.Printf("engine stream recv error: %v", err)
			continue
		}

		// Persist events to the database and broadcast to the dashboard.
		b.handleEvent(incoming)
	}
}

func (b *engineBridge) handleEvent(ev *engine.EngineEvent) {
	channel := ""
	var payload interface{}

	switch p := ev.Payload.(type) {
	case *engine.EngineEvent_TokenDetected:
		channel = "tokens:new"
		t := p.TokenDetected
		payload = Token{
			ID:                     t.ID,
			Chain:                  Chain(t.Chain),
			Address:                t.Address,
			Symbol:                 t.Symbol,
			Name:                   t.Name,
			LiquidityUsd:           t.LiquidityUsd,
			Holders:                int(t.Holders),
			AgeSeconds:             int(t.AgeSeconds),
			Top10Pct:               t.Top10Pct,
			RugScore:               t.RugScore,
			VolumeUsd:              t.VolumeUsd,
			PriceUsd:               t.PriceUsd,
			FilterPassed:           t.FilterPassed,
			FailReasons:            t.FailReasons,
			DetectedAt:             t.DetectedAt,
			PoolAddress:            t.PoolAddress,
			MintAuthorityRevoked:   t.MintAuthorityRevoked,
			FreezeAuthorityRevoked: t.FreezeAuthorityRevoked,
			Honeypot:               t.Honeypot,
			BuyTaxPct:              t.BuyTaxPct,
			SellTaxPct:             t.SellTaxPct,
		}
	case *engine.EngineEvent_TradeUpdate:
		channel = "trades:new"
		t := p.TradeUpdate
		payload = Trade{
			ID:          t.ID,
			TokenID:     t.TokenID,
			TokenSymbol: t.TokenSymbol,
			Chain:       Chain(t.Chain),
			Side:        t.Side,
			AmountUsd:   t.AmountUsd,
			PriceUsd:    t.PriceUsd,
			TxHash:      t.TxHash,
			Status:      t.Status,
			FeesUsd:     t.FeesUsd,
			PnlUsd:      t.PnlUsd,
			PnlPct:      t.PnlPct,
			ExecutedAt:  t.ExecutedAt,
			SellReason:  t.SellReason,
		}
	case *engine.EngineEvent_PositionUpdate:
		channel = "positions:new"
		p := p.PositionUpdate
		payload = Position{
			ID:                 p.ID,
			TokenID:            p.TokenID,
			TokenSymbol:        p.TokenSymbol,
			Chain:              Chain(p.Chain),
			EntryPriceUsd:      p.EntryPriceUsd,
			CurrentPriceUsd:    p.CurrentPriceUsd,
			PeakPriceUsd:       p.PeakPriceUsd,
			SizeUsd:            p.SizeUsd,
			Status:             p.Status,
			Tp1Hit:             p.Tp1Hit,
			TrailingStopActive: p.TrailingStopActive,
			StopLossPrice:      p.StopLossPrice,
			UnrealisedPnlUsd:   p.UnrealisedPnlUsd,
			UnrealisedPnlPct:   p.UnrealisedPnlPct,
			OpenedAt:           p.OpenedAt,
			ClosedAt:           p.ClosedAt,
		}
	case *engine.EngineEvent_Log:
		channel = "log"
		payload = map[string]string{
			"level":     p.Log.Level,
			"message":   p.Log.Message,
			"timestamp": p.Log.Timestamp,
		}
	default:
		return
	}

	wrapped := map[string]interface{}{
		"channel":   channel,
		"id":        fmt.Sprintf("%s-%d", channel, time.Now().UnixMilli()),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payload,
	}
	data, _ := json.Marshal(wrapped)
	b.wss.broadcastMsg(data)
}
