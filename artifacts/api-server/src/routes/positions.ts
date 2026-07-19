import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, positionsTable } from "@workspace/db";
import {
  ListPositionsQueryParams,
  ListPositionsResponse,
  GetPositionParams,
  GetPositionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializePosition(p: typeof positionsTable.$inferSelect) {
  return {
    ...p,
    openedAt: p.openedAt.toISOString(),
    closedAt: p.closedAt?.toISOString() ?? null,
    stopLossPrice: p.stopLossPrice ?? null,
    realisedPnlUsd: p.realisedPnlUsd ?? null,
  };
}

router.get("/positions", async (req, res): Promise<void> => {
  const params = ListPositionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { status, limit } = params.data;

  let query = db.select().from(positionsTable).$dynamic();

  if (status && status !== "all") {
    query = query.where(eq(positionsTable.status, status));
  }

  const positions = await query
    .orderBy(desc(positionsTable.openedAt))
    .limit(limit ?? 50);

  res.json(ListPositionsResponse.parse(positions.map(serializePosition)));
});

router.get("/positions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPositionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [position] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.id, params.data.id));

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  res.json(GetPositionResponse.parse(serializePosition(position)));
});

export default router;
