import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, tokensTable } from "@workspace/db";
import {
  ListTokensQueryParams,
  ListTokensResponse,
  GetTokenParams,
  GetTokenResponse,
  GetLiveFeedResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tokens/live-feed", async (req, res): Promise<void> => {
  const tokens = await db
    .select()
    .from(tokensTable)
    .orderBy(desc(tokensTable.detectedAt))
    .limit(50);

  res.json(GetLiveFeedResponse.parse(
    tokens.map(t => ({
      ...t,
      failReasons: t.failReasons as string[] | null,
      detectedAt: t.detectedAt.toISOString(),
      priceUsd: t.priceUsd ?? null,
      poolAddress: t.poolAddress ?? null,
    }))
  ));
});

router.get("/tokens", async (req, res): Promise<void> => {
  const params = ListTokensQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit, offset, chain, filterStatus } = params.data;

  let query = db.select().from(tokensTable).$dynamic();

  if (chain && chain !== "all") {
    query = query.where(eq(tokensTable.chain, chain));
  }

  if (filterStatus === "passed") {
    query = query.where(eq(tokensTable.filterPassed, true));
  } else if (filterStatus === "failed") {
    query = query.where(eq(tokensTable.filterPassed, false));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tokensTable);

  const tokens = await query
    .orderBy(desc(tokensTable.detectedAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(ListTokensResponse.parse({
    tokens: tokens.map(t => ({
      ...t,
      failReasons: t.failReasons as string[] | null,
      detectedAt: t.detectedAt.toISOString(),
      priceUsd: t.priceUsd ?? null,
      poolAddress: t.poolAddress ?? null,
    })),
    total: count,
  }));
});

router.get("/tokens/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTokenParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [token] = await db
    .select()
    .from(tokensTable)
    .where(eq(tokensTable.id, params.data.id));

  if (!token) {
    res.status(404).json({ error: "Token not found" });
    return;
  }

  res.json(GetTokenResponse.parse({
    ...token,
    failReasons: token.failReasons as string[] | null,
    detectedAt: token.detectedAt.toISOString(),
    priceUsd: token.priceUsd ?? null,
    poolAddress: token.poolAddress ?? null,
  }));
});

export default router;
