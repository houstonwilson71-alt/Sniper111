// services/api-go/db.go
// PostgreSQL persistence layer using pgx. This is intentionally a thin
// CRUD mirror of the Drizzle schema; it is NOT optimized for production scale.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type DB struct {
	*sql.DB
}

func mustInitDB() *DB {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgresql://sniper:sniper@localhost:5432/sniper"
	}
	db, err := sql.Open("pgx", url)
	if err != nil {
		panic(err)
	}
	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "database ping failed: %v\n", err)
	}
	return &DB{db}
}

func (db *DB) GetConfig() (*BotConfig, error) {
	row := db.QueryRowContext(context.Background(), `
		SELECT id, enable_solana, enable_bsc, min_liquidity_usd, max_token_age_seconds,
		       min_holders, max_top10_pct, max_rug_score, min_volume_usd, buy_amount_sol,
		       buy_amount_bnb, slippage_pct, jito_tip_lamports, tp1_pct, tp1_sell_pct,
		       trailing_stop_pct, time_exit_minutes, time_exit_min_profit_pct, enabled
		FROM bot_config LIMIT 1
	`)
	cfg := BotConfig{}
	var id int
	err := row.Scan(&id, &cfg.EnableSolana, &cfg.EnableBsc, &cfg.MinLiquidityUsd,
		&cfg.MaxTokenAgeSeconds, &cfg.MinHolders, &cfg.MaxTop10Pct, &cfg.MaxRugScore,
		&cfg.MinVolumeUsd, &cfg.BuyAmountSol, &cfg.BuyAmountBnb, &cfg.SlippagePct,
		&cfg.JitoTipLamports, &cfg.Tp1Pct, &cfg.Tp1SellPct, &cfg.TrailingStopPct,
		&cfg.TimeExitMinutes, &cfg.TimeExitMinProfitPct, &cfg.Enabled)
	if err == sql.ErrNoRows {
		return &BotConfig{
			EnableSolana: true, EnableBsc: true,
			MinLiquidityUsd: 5000, MaxTokenAgeSeconds: 300, MinHolders: 25,
			MaxTop10Pct: 35, MaxRugScore: 2, MinVolumeUsd: 1000,
			BuyAmountSol: 0.01, BuyAmountBnb: 0.01, SlippagePct: 15,
			JitoTipLamports: 10000, Tp1Pct: 100, Tp1SellPct: 50,
			TrailingStopPct: 25, TimeExitMinutes: 120, TimeExitMinProfitPct: 20,
			Enabled: true,
		}, nil
	}
	return &cfg, err
}

func (db *DB) UpdateConfig(cfg BotConfig) (*BotConfig, error) {
	_, err := db.ExecContext(context.Background(), `
		UPDATE bot_config SET
			enable_solana = $1, enable_bsc = $2, min_liquidity_usd = $3, max_token_age_seconds = $4,
			min_holders = $5, max_top10_pct = $6, max_rug_score = $7, min_volume_usd = $8,
			buy_amount_sol = $9, buy_amount_bnb = $10, slippage_pct = $11, jito_tip_lamports = $12,
			tp1_pct = $13, tp1_sell_pct = $14, trailing_stop_pct = $15, time_exit_minutes = $16,
			time_exit_min_profit_pct = $17, enabled = $18, updated_at = NOW()
		WHERE id = 1
	`, cfg.EnableSolana, cfg.EnableBsc, cfg.MinLiquidityUsd, cfg.MaxTokenAgeSeconds,
		cfg.MinHolders, cfg.MaxTop10Pct, cfg.MaxRugScore, cfg.MinVolumeUsd,
		cfg.BuyAmountSol, cfg.BuyAmountBnb, cfg.SlippagePct, cfg.JitoTipLamports,
		cfg.Tp1Pct, cfg.Tp1SellPct, cfg.TrailingStopPct, cfg.TimeExitMinutes,
		cfg.TimeExitMinProfitPct, cfg.Enabled)
	if err != nil {
		return nil, err
	}
	return db.GetConfig()
}

func (db *DB) GetState() (*BotState, error) {
	row := db.QueryRowContext(context.Background(), `
		SELECT id, running, started_at, stopped_at, error, emergency_stopped, live_trading_enabled, wallet_address
		FROM bot_state LIMIT 1
	`)
	st := BotState{}
	var startedAt, stoppedAt sql.NullTime
	err := row.Scan(&st.ID, &st.Running, &startedAt, &stoppedAt, &st.Error, &st.EmergencyStopped, &st.LiveTradingEnabled, &st.WalletAddress)
	if err == sql.ErrNoRows {
		return &BotState{LiveTradingEnabled: os.Getenv("LIVE_TRADING_ENABLED") == "true"}, nil
	}
	if startedAt.Valid {
		st.StartedAt = &startedAt.Time
	}
	if stoppedAt.Valid {
		st.StoppedAt = &stoppedAt.Time
	}
	return &st, err
}

func (db *DB) SetRunning(running bool) (*BotState, error) {
	startedAt := sql.NullTime{}
	stoppedAt := sql.NullTime{}
	if running {
		startedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	} else {
		stoppedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	_, err := db.ExecContext(context.Background(), `
		UPDATE bot_state SET running = $1, started_at = $2, stopped_at = $3
		WHERE id = (SELECT id FROM bot_state LIMIT 1)
	`, running, startedAt, stoppedAt)
	if err != nil {
		return nil, err
	}
	return db.GetState()
}

func (db *DB) SetEmergencyStop(stop bool, reason string) (*BotState, error) {
	_, err := db.ExecContext(context.Background(), `
		UPDATE bot_state SET emergency_stopped = $1, error = $2
		WHERE id = (SELECT id FROM bot_state LIMIT 1)
	`, stop, reason)
	if err != nil {
		return nil, err
	}
	return db.GetState()
}

func (db *DB) GetWallet() (WalletConfig, error) {
	row := db.QueryRowContext(context.Background(), `
		SELECT solana_private_key, bsc_private_key, use_wallet_connect
		FROM wallet_config LIMIT 1
	`)
	w := WalletConfig{}
	var sol, bsc sql.NullString
	err := row.Scan(&sol, &bsc, &w.UseWalletConnect)
	if err == sql.ErrNoRows {
		return w, nil
	}
	w.SolanaPrivateKey = sol.String
	w.BscPrivateKey = bsc.String
	return w, err
}

func (db *DB) UpdateWallet(w WalletConfig) (WalletConfig, error) {
	_, err := db.ExecContext(context.Background(), `
		UPDATE wallet_config SET
			solana_private_key = $1, bsc_private_key = $2, use_wallet_connect = $3
		WHERE id = (SELECT id FROM wallet_config LIMIT 1)
	`, w.SolanaPrivateKey, w.BscPrivateKey, w.UseWalletConnect)
	if err != nil {
		return WalletConfig{}, err
	}
	return db.GetWallet()
}

func (db *DB) GetTokens() ([]Token, error) {
	rows, err := db.QueryContext(context.Background(), `
		SELECT id, chain, address, symbol, name, pool_address, liquidity_usd, holders, age_seconds,
		       top10_pct, rug_score, volume_usd, price_usd, filter_passed, fail_reasons,
		       mint_authority_revoked, freeze_authority_revoked, honeypot, buy_tax_pct, sell_tax_pct, detected_at
		FROM tokens ORDER BY detected_at DESC LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Token, 0)
	for rows.Next() {
		var t Token
		var failReasons []byte
		_ = rows.Scan(&t.ID, &t.Chain, &t.Address, &t.Symbol, &t.Name, &t.PoolAddress, &t.LiquidityUsd, &t.Holders,
			&t.AgeSeconds, &t.Top10Pct, &t.RugScore, &t.VolumeUsd, &t.PriceUsd, &t.FilterPassed, &failReasons,
			&t.MintAuthorityRevoked, &t.FreezeAuthorityRevoked, &t.Honeypot, &t.BuyTaxPct, &t.SellTaxPct, &t.DetectedAt)
		if len(failReasons) > 0 {
			_ = json.Unmarshal(failReasons, &t.FailReasons)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (db *DB) GetTrades() ([]Trade, error) {
	rows, err := db.QueryContext(context.Background(), `
		SELECT id, token_id, token_symbol, token_address, chain, position_id, side, amount_usd, price_usd,
		       tx_hash, status, fees_usd, pnl_usd, pnl_pct, executed_at, sell_reason
		FROM trades ORDER BY executed_at DESC LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Trade, 0)
	for rows.Next() {
		var t Trade
		_ = rows.Scan(&t.ID, &t.TokenID, &t.TokenSymbol, &t.TokenAddress, &t.Chain, &t.PositionID, &t.Side,
			&t.AmountUsd, &t.PriceUsd, &t.TxHash, &t.Status, &t.FeesUsd, &t.PnlUsd, &t.PnlPct, &t.ExecutedAt, &t.SellReason)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (db *DB) GetPositions() ([]Position, error) {
	rows, err := db.QueryContext(context.Background(), `
		SELECT id, token_id, token_symbol, token_address, chain, entry_price_usd, current_price_usd,
		       peak_price_usd, size_usd, status, tp1_hit, tp2_hit, trailing_stop_active, stop_loss_price,
		       unrealised_pnl_usd, unrealised_pnl_pct, realised_pnl_usd, opened_at, closed_at
		FROM positions WHERE status = 'open' ORDER BY opened_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Position, 0)
	for rows.Next() {
		var p Position
		_ = rows.Scan(&p.ID, &p.TokenID, &p.TokenSymbol, &p.TokenAddress, &p.Chain, &p.EntryPriceUsd, &p.CurrentPriceUsd,
			&p.PeakPriceUsd, &p.SizeUsd, &p.Status, &p.Tp1Hit, &p.Tp2Hit, &p.TrailingStopActive, &p.StopLossPrice,
			&p.UnrealisedPnlUsd, &p.UnrealisedPnlPct, &p.RealisedPnlUsd, &p.OpenedAt, &p.ClosedAt)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (db *DB) GetPerformanceSummary() (PerformanceSummary, error) {
	row := db.QueryRowContext(context.Background(), `
		SELECT
			COALESCE(SUM(pnl_usd), 0) as total_pnl,
			COUNT(*) as total_trades,
			SUM(CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END) as wins
		FROM trades
	`)
	ps := PerformanceSummary{}
	var wins int
	err := row.Scan(&ps.TotalPnlUsd, &ps.TotalTrades, &wins)
	if err != nil && err != sql.ErrNoRows {
		return ps, err
	}
	if ps.TotalTrades > 0 {
		ps.WinRate = float64(wins) / float64(ps.TotalTrades) * 100
	}
	ps.OpenPositions = len(must(db.GetPositions()))
	ps.ClosedPositions = ps.TotalTrades - ps.OpenPositions
	return ps, nil
}

func (db *DB) GetEquity() ([]EquityPoint, error) {
	rows, err := db.QueryContext(context.Background(), `
		SELECT timestamp, equity_usd, pnl_usd FROM equity_history ORDER BY timestamp DESC LIMIT 168
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]EquityPoint, 0)
	for rows.Next() {
		var e EquityPoint
		_ = rows.Scan(&e.Timestamp, &e.EquityUsd, &e.PnlUsd)
		out = append(out, e)
	}
	return out, rows.Err()
}

func must[T any](v T, err error) T {
	if err != nil {
		return *new(T)
	}
	return v
}
