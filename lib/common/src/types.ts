/**
 * Shared domain types for the Meme Coin Sniper.
 * These types are used by the frontend, backend, and Rust services.
 */

export type Chain = "solana" | "bsc";

export type TokenStatus = "pending" | "filtered" | "passed" | "failed" | "bought" | "sold";

export interface Token {
  id: string;
  chain: Chain;
  address: string;
  symbol: string;
  name: string;
  liquidityUsd: number;
  holders: number;
  ageSeconds: number;
  top10Pct: number;
  rugScore: number;
  volumeUsd: number;
  priceUsd: number;
  filterPassed: boolean;
  failReasons: string[];
  detectedAt: string;
  poolAddress: string;
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  honeypot?: boolean;
  buyTaxPct?: number;
  sellTaxPct?: number;
}

export interface BotConfig {
  id?: number;
  enableSolana: boolean;
  enableBsc: boolean;
  minLiquidityUsd: number;
  maxTokenAgeSeconds: number;
  minHolders: number;
  maxTop10Pct: number;
  maxRugScore: number;
  minVolumeUsd: number;
  buyAmountSol: number;
  buyAmountBnb: number;
  slippagePct: number;
  jitoTipLamports: number;
  tp1Pct: number;
  tp1SellPct: number;
  trailingStopPct: number;
  timeExitMinutes: number;
  timeExitMinProfitPct: number;
  enabled: boolean;
}

export interface BotState {
  id?: number;
  running: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  error: string | null;
  emergencyStopped: boolean;
  liveTradingEnabled: boolean;
  walletAddress: string | null;
}

export interface WalletConfig {
  solanaPrivateKey?: string;
  bscPrivateKey?: string;
  useWalletConnect?: boolean;
}

export interface Position {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  tokenAddress: string;
  chain: Chain;
  entryPriceUsd: number;
  currentPriceUsd: number;
  peakPriceUsd: number;
  sizeUsd: number;
  status: "open" | "closed";
  tp1Hit: boolean;
  tp2Hit: boolean;
  trailingStopActive: boolean;
  stopLossPrice: number | null;
  unrealisedPnlUsd: number;
  unrealisedPnlPct: number;
  realisedPnlUsd: number | null;
  openedAt: string;
  closedAt: string | null;
}

export interface Trade {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  tokenAddress: string;
  chain: Chain;
  positionId: string;
  side: "buy" | "sell";
  amountUsd: number;
  priceUsd: number;
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  feesUsd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  executedAt: string;
  sellReason?: string;
}

export interface EquityPoint {
  timestamp: string;
  equityUsd: number;
  pnlUsd: number;
}

export interface PerformanceSummary {
  totalPnlUsd: number;
  winRate: number;
  totalTrades: number;
  openPositions: number;
  closedPositions: number;
  avgProfitPct: number;
  avgLossPct: number;
  chainBreakdown: ChainBreakdown[];
}

export interface ChainBreakdown {
  chain: Chain;
  pnlUsd: number;
  trades: number;
  wins: number;
}

export interface SafetyCheckRequest {
  token: Token;
  config: BotConfig;
}

export interface SafetyCheckResult {
  passed: boolean;
  reasons: string[];
  honeypot: boolean;
  buyTaxPct: number;
  sellTaxPct: number;
  mintRevoked: boolean;
  freezeRevoked: boolean;
}

export interface BuySignal {
  token: Token;
  amountUsd: number;
  slippagePct: number;
  jitoTipLamports?: number;
}

export interface SellSignal {
  position: Position;
  reason: "tp1" | "trailing_stop" | "time_exit" | "manual";
  sellPct: number;
  targetPriceUsd?: number;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  enableSolana: true,
  enableBsc: true,
  minLiquidityUsd: 5000,
  maxTokenAgeSeconds: 300,
  minHolders: 25,
  maxTop10Pct: 35,
  maxRugScore: 2,
  minVolumeUsd: 1000,
  buyAmountSol: 0.01,
  buyAmountBnb: 0.01,
  slippagePct: 15,
  jitoTipLamports: 10000,
  tp1Pct: 100,
  tp1SellPct: 50,
  trailingStopPct: 25,
  timeExitMinutes: 120,
  timeExitMinProfitPct: 20,
  enabled: false,
};
