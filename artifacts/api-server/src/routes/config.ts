import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, botConfigTable, botStateTable } from "@workspace/db";

const router: IRouter = Router();

async function ensureConfig() {
  const rows = await db.select().from(botConfigTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(botConfigTable).values({}).returning();
    return row;
  }
  return rows[0];
}

async function ensureBotState() {
  const rows = await db.select().from(botStateTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(botStateTable).values({ running: false }).returning();
    return row;
  }
  return rows[0];
}

router.get("/config", async (req, res): Promise<void> => {
  const config = await ensureConfig();
  res.json(config);
});

router.put("/config", async (req, res): Promise<void> => {
  const existing = await ensureConfig();
  const [updated] = await db
    .update(botConfigTable)
    .set(req.body)
    .where(eq(botConfigTable.id, existing.id))
    .returning();

  res.json(updated);
});

router.get("/bot/status", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  res.json({
    running: state.running,
    startedAt: state.startedAt?.toISOString() ?? null,
    stoppedAt: state.stoppedAt?.toISOString() ?? null,
    error: state.error,
    emergencyStopped: state.emergencyStopped,
    liveTradingEnabled: state.liveTradingEnabled,
    walletAddress: state.walletAddress,
  });
});

router.post("/bot/start", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  if (state.emergencyStopped) {
    res.status(403).json({ error: "Emergency stop is active. Reset it before starting." });
    return;
  }
  const [updated] = await db
    .update(botStateTable)
    .set({ running: true, startedAt: new Date(), stoppedAt: null, error: null })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
    error: updated.error,
    emergencyStopped: updated.emergencyStopped,
    liveTradingEnabled: updated.liveTradingEnabled,
    walletAddress: updated.walletAddress,
  });
});

router.post("/bot/stop", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  const [updated] = await db
    .update(botStateTable)
    .set({ running: false, stoppedAt: new Date() })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
    error: updated.error,
    emergencyStopped: updated.emergencyStopped,
    liveTradingEnabled: updated.liveTradingEnabled,
    walletAddress: updated.walletAddress,
  });
});

router.post("/bot/emergency-stop", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  const [updated] = await db
    .update(botStateTable)
    .set({ running: false, emergencyStopped: true, stoppedAt: new Date(), error: req.body?.reason || "Emergency stop triggered" })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
    error: updated.error,
    emergencyStopped: updated.emergencyStopped,
    liveTradingEnabled: updated.liveTradingEnabled,
    walletAddress: updated.walletAddress,
  });
});

router.post("/bot/reset-emergency", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  const [updated] = await db
    .update(botStateTable)
    .set({ emergencyStopped: false, error: null })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
    error: updated.error,
    emergencyStopped: updated.emergencyStopped,
    liveTradingEnabled: updated.liveTradingEnabled,
    walletAddress: updated.walletAddress,
  });
});

export default router;
