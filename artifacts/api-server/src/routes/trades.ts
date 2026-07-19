import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, tradesTable } from "@workspace/db";
import {
  ListTradesQueryParams,
  ListTradesResponse,
  GetTradeParams,
  GetTradeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trades", async (req, res): Promise<void> => {
  const params = ListTradesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit, offset, side } = params.data;

  let query = db.select().from(tradesTable).$dynamic();

  if (side && side !== "all") {
    query = query.where(eq(tradesTable.side, side));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tradesTable);

  const trades = await query
    .orderBy(desc(tradesTable.executedAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(ListTradesResponse.parse({
    trades: trades.map(t => ({
      ...t,
      executedAt: t.executedAt.toISOString(),
      feesUsd: t.feesUsd ?? null,
      pnlUsd: t.pnlUsd ?? null,
      pnlPct: t.pnlPct ?? null,
      positionId: t.positionId ?? null,
    })),
    total: count,
  }));
});

router.get("/trades/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTradeParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.id, params.data.id));

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.json(GetTradeResponse.parse({
    ...trade,
    executedAt: trade.executedAt.toISOString(),
    feesUsd: trade.feesUsd ?? null,
    pnlUsd: trade.pnlUsd ?? null,
    pnlPct: trade.pnlPct ?? null,
    positionId: trade.positionId ?? null,
  }));
});

export default router;
