import { Router, type IRouter } from "express";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { db, tradesTable, positionsTable, tokensTable, equityHistoryTable } from "@workspace/db";
import {
  GetPerformanceSummaryResponse,
  GetEquityCurveQueryParams,
  GetEquityCurveResponse,
  GetChainBreakdownResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/performance/summary", async (req, res): Promise<void> => {
  // Closed trades for win rate
  const closedTrades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.side, "sell"), eq(tradesTable.status, "confirmed")));

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => (t.pnlUsd ?? 0) > 0).length;
  const losingTrades = closedTrades.filter(t => (t.pnlUsd ?? 0) <= 0).length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
  const totalPnlUsd = closedTrades.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const pnlValues = closedTrades.map(t => t.pnlUsd ?? 0);
  const bestTradeUsd = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const worstTradeUsd = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  // Open positions count
  const [{ openPositions }] = await db
    .select({ openPositions: sql<number>`cast(count(*) as int)` })
    .from(positionsTable)
    .where(eq(positionsTable.status, "open"));

  // Tokens scanned today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ scannedToday }] = await db
    .select({ scannedToday: sql<number>`cast(count(*) as int)` })
    .from(tokensTable)
    .where(gte(tokensTable.detectedAt, startOfDay));

  const [{ passedToday }] = await db
    .select({ passedToday: sql<number>`cast(count(*) as int)` })
    .from(tokensTable)
    .where(and(gte(tokensTable.detectedAt, startOfDay), eq(tokensTable.filterPassed, true)));

  // Average hold time from closed positions
  const closedPositions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.status, "closed"));

  let avgHoldTimeMinutes = 0;
  if (closedPositions.length > 0) {
    const totalMinutes = closedPositions.reduce((sum, p) => {
      if (!p.closedAt) return sum;
      return sum + (p.closedAt.getTime() - p.openedAt.getTime()) / 60000;
    }, 0);
    avgHoldTimeMinutes = totalMinutes / closedPositions.length;
  }

  const initialCapital = 1000; // assumed starting capital for pct calculation
  const totalPnlPct = totalPnlUsd / initialCapital;

  res.json(GetPerformanceSummaryResponse.parse({
    totalPnlUsd,
    totalPnlPct,
    winRate,
    totalTrades,
    winningTrades,
    losingTrades,
    openPositions,
    tokensScannedToday: scannedToday,
    tokensPassedToday: passedToday,
    avgHoldTimeMinutes,
    bestTradeUsd,
    worstTradeUsd,
  }));
});

router.get("/performance/equity", async (req, res): Promise<void> => {
  const params = GetEquityCurveQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { period } = params.data;

  let cutoff: Date | null = null;
  const now = new Date();
  if (period === "1d") {
    cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "7d") {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "30d") {
    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  let query = db.select().from(equityHistoryTable).$dynamic();
  if (cutoff) {
    query = query.where(gte(equityHistoryTable.timestamp, cutoff));
  }

  const points = await query.orderBy(equityHistoryTable.timestamp).limit(500);

  res.json(GetEquityCurveResponse.parse(
    points.map(p => ({
      timestamp: p.timestamp.toISOString(),
      equityUsd: p.equityUsd,
      pnlUsd: p.pnlUsd,
    }))
  ));
});

router.get("/performance/chain-breakdown", async (req, res): Promise<void> => {
  const chains = ["solana", "bsc"];
  const breakdown = await Promise.all(
    chains.map(async (chain) => {
      const trades = await db
        .select()
        .from(tradesTable)
        .where(and(eq(tradesTable.chain, chain), eq(tradesTable.side, "sell"), eq(tradesTable.status, "confirmed")));

      const tradeCount = trades.length;
      const totalPnlUsd = trades.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
      const winning = trades.filter(t => (t.pnlUsd ?? 0) > 0).length;
      const winRate = tradeCount > 0 ? winning / tradeCount : 0;

      return { chain, totalPnlUsd, winRate, tradeCount };
    })
  );

  res.json(GetChainBreakdownResponse.parse(breakdown));
});

export default router;
