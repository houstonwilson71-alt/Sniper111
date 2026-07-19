import { type BotConfig, type BotState, type Token, type Position, type Trade, type EquityPoint } from "@workspace/common";

const API = "/api";

export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function poster<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function putter<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getConfig: () => fetcher<BotConfig>("/config"),
  updateConfig: (body: Partial<BotConfig>) => putter<BotConfig>("/config", body),
  getBotStatus: () => fetcher<BotState>("/bot/status"),
  startBot: () => poster<BotState>("/bot/start", {}),
  stopBot: () => poster<BotState>("/bot/stop", {}),
  emergencyStop: (reason: string) => poster<BotState>("/bot/emergency-stop", { reason }),
  resetEmergency: () => poster<BotState>("/bot/reset-emergency", {}),
  getWallet: () => fetcher<{ solanaPrivateKey: string | null; bscPrivateKey: string | null; useWalletConnect: boolean; liveTradingEnabled: boolean }>("/wallet"),
  updateWallet: (body: { solanaPrivateKey?: string; bscPrivateKey?: string; useWalletConnect?: boolean }) => putter<{
    solanaPrivateKey: string | null;
    bscPrivateKey: string | null;
    useWalletConnect: boolean;
    liveTradingEnabled: boolean;
  }>("/wallet", body),
  getTokens: () => fetcher<{ items: Token[] }>("/tokens"),
  getTrades: () => fetcher<{ items: Trade[] }>("/trades"),
  getPositions: () => fetcher<{ items: Position[] }>("/positions"),
  getPerformance: () => fetcher<{ summary: { totalPnlUsd: number; winRate: number; totalTrades: number; openPositions: number; closedPositions: number } }>("/performance/summary"),
  getEquity: () => fetcher<{ items: EquityPoint[] }>("/performance/equity"),
};

export function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws`;
}

export function useWebSocket(onMessage: (event: MessageEvent) => void) {
  if (typeof window === "undefined") return null;
  const wsUrl = getWsUrl();
  const ws = new WebSocket(wsUrl);
  ws.onmessage = onMessage;
  ws.onerror = (e) => console.error("WebSocket error", e);
  ws.onclose = () => setTimeout(() => useWebSocket(onMessage), 3000);
  return ws;
}
