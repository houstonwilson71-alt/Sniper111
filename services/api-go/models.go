// services/api-go/models.go
// Shared domain models matching the TypeScript/Rust contracts.
package main

import "time"

type Chain string

const (
	ChainSolana Chain = "solana"
	ChainBSC    Chain = "bsc"
)

type BotConfig struct {
	ID                     int     `json:"id,omitempty"`
	EnableSolana           bool    `json:"enableSolana"`
	EnableBsc              bool    `json:"enableBsc"`
	MinLiquidityUsd        float64 `json:"minLiquidityUsd"`
	MaxTokenAgeSeconds     int     `json:"maxTokenAgeSeconds"`
	MinHolders             int     `json:"minHolders"`
	MaxTop10Pct            float64 `json:"maxTop10Pct"`
	MaxRugScore            float64 `json:"maxRugScore"`
	MinVolumeUsd           float64 `json:"minVolumeUsd"`
	BuyAmountSol           float64 `json:"buyAmountSol"`
	BuyAmountBnb           float64 `json:"buyAmountBnb"`
	SlippagePct            float64 `json:"slippagePct"`
	JitoTipLamports        int64   `json:"jitoTipLamports"`
	Tp1Pct                 float64 `json:"tp1Pct"`
	Tp1SellPct             float64 `json:"tp1SellPct"`
	TrailingStopPct        float64 `json:"trailingStopPct"`
	TimeExitMinutes        int     `json:"timeExitMinutes"`
	TimeExitMinProfitPct   float64 `json:"timeExitMinProfitPct"`
	Enabled                bool    `json:"enabled"`
}

type BotState struct {
	ID               int        `json:"id,omitempty"`
	Running          bool       `json:"running"`
	StartedAt        *time.Time `json:"startedAt,omitempty"`
	StoppedAt        *time.Time `json:"stoppedAt,omitempty"`
	Error            string     `json:"error,omitempty"`
	EmergencyStopped bool       `json:"emergencyStopped"`
	LiveTradingEnabled bool     `json:"liveTradingEnabled"`
	WalletAddress    string     `json:"walletAddress,omitempty"`
}

type WalletConfig struct {
	SolanaPrivateKey string `json:"solanaPrivateKey,omitempty"`
	BscPrivateKey    string `json:"bscPrivateKey,omitempty"`
	UseWalletConnect bool   `json:"useWalletConnect,omitempty"`
}

func (w WalletConfig) Public() WalletConfig {
	out := WalletConfig{UseWalletConnect: w.UseWalletConnect}
	if w.SolanaPrivateKey != "" {
		out.SolanaPrivateKey = "[encrypted]"
	}
	if w.BscPrivateKey != "" {
		out.BscPrivateKey = "[encrypted]"
	}
	return out
}

type Token struct {
	ID                  string  `json:"id"`
	Chain               Chain   `json:"chain"`
	Address             string  `json:"address"`
	Symbol              string  `json:"symbol"`
	Name                string  `json:"name"`
	LiquidityUsd        float64 `json:"liquidityUsd"`
	Holders             int     `json:"holders"`
	AgeSeconds          int     `json:"ageSeconds"`
	Top10Pct            float64 `json:"top10Pct"`
	RugScore            float64 `json:"rugScore"`
	VolumeUsd           float64 `json:"volumeUsd"`
	PriceUsd            float64 `json:"priceUsd"`
	FilterPassed        bool    `json:"filterPassed"`
	FailReasons         []string `json:"failReasons"`
	DetectedAt          string  `json:"detectedAt"`
	PoolAddress         string  `json:"poolAddress"`
	MintAuthorityRevoked bool   `json:"mintAuthorityRevoked,omitempty"`
	FreezeAuthorityRevoked bool `json:"freezeAuthorityRevoked,omitempty"`
	Honeypot            bool    `json:"honeypot,omitempty"`
	BuyTaxPct           float64 `json:"buyTaxPct,omitempty"`
	SellTaxPct          float64 `json:"sellTaxPct,omitempty"`
}

type Position struct {
	ID                 string  `json:"id"`
	TokenID            string  `json:"tokenId"`
	TokenSymbol        string  `json:"tokenSymbol"`
	TokenAddress       string  `json:"tokenAddress"`
	Chain              Chain   `json:"chain"`
	EntryPriceUsd      float64 `json:"entryPriceUsd"`
	CurrentPriceUsd    float64 `json:"currentPriceUsd"`
	PeakPriceUsd       float64 `json:"peakPriceUsd"`
	SizeUsd            float64 `json:"sizeUsd"`
	Status             string  `json:"status"`
	Tp1Hit             bool    `json:"tp1Hit"`
	Tp2Hit             bool    `json:"tp2Hit"`
	TrailingStopActive bool    `json:"trailingStopActive"`
	StopLossPrice      float64 `json:"stopLossPrice,omitempty"`
	UnrealisedPnlUsd   float64 `json:"unrealisedPnlUsd"`
	UnrealisedPnlPct   float64 `json:"unrealisedPnlPct"`
	RealisedPnlUsd     float64 `json:"realisedPnlUsd,omitempty"`
	OpenedAt           string  `json:"openedAt"`
	ClosedAt           string  `json:"closedAt,omitempty"`
}

type Trade struct {
	ID          string  `json:"id"`
	TokenID     string  `json:"tokenId"`
	TokenSymbol string  `json:"tokenSymbol"`
	TokenAddress string `json:"tokenAddress"`
	Chain       Chain   `json:"chain"`
	PositionID  string  `json:"positionId"`
	Side        string  `json:"side"`
	AmountUsd   float64 `json:"amountUsd"`
	PriceUsd    float64 `json:"priceUsd"`
	TxHash      string  `json:"txHash"`
	Status      string  `json:"status"`
	FeesUsd     float64 `json:"feesUsd"`
	PnlUsd      float64 `json:"pnlUsd,omitempty"`
	PnlPct      float64 `json:"pnlPct,omitempty"`
	ExecutedAt  string  `json:"executedAt"`
	SellReason  string  `json:"sellReason,omitempty"`
}

type EquityPoint struct {
	Timestamp string  `json:"timestamp"`
	EquityUsd float64 `json:"equityUsd"`
	PnlUsd    float64 `json:"pnlUsd"`
}

type PerformanceSummary struct {
	TotalPnlUsd      float64          `json:"totalPnlUsd"`
	WinRate          float64          `json:"winRate"`
	TotalTrades      int              `json:"totalTrades"`
	OpenPositions    int              `json:"openPositions"`
	ClosedPositions  int              `json:"closedPositions"`
	AvgProfitPct     float64          `json:"avgProfitPct"`
	AvgLossPct       float64          `json:"avgLossPct"`
	ChainBreakdown   []ChainBreakdown `json:"chainBreakdown"`
}

type ChainBreakdown struct {
	Chain  Chain   `json:"chain"`
	PnlUsd float64 `json:"pnlUsd"`
	Trades int     `json:"trades"`
	Wins   int     `json:"wins"`
}
