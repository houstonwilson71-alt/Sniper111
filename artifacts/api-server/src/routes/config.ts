import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, botConfigTable, botStateTable } from "@workspace/db";
import {
  GetConfigResponse,
  UpdateConfigBody,
  GetBotStatusResponse,
  StartBotResponse,
  StopBotResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Ensure default config row exists
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
  res.json(GetConfigResponse.parse({
    ...config,
    chains: [
      ...(config.enableSolana ? ["solana"] : []),
      ...(config.enableBsc ? ["bsc"] : []),
    ],
  }));
});

router.put("/config", async (req, res): Promise<void> => {
  const parsed = UpdateConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await ensureConfig();
  const [updated] = await db
    .update(botConfigTable)
    .set(parsed.data)
    .where(eq(botConfigTable.id, existing.id))
    .returning();

  res.json(GetConfigResponse.parse({
    ...updated,
    chains: [
      ...(updated.enableSolana ? ["solana"] : []),
      ...(updated.enableBsc ? ["bsc"] : []),
    ],
  }));
});

router.get("/bot/status", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  res.json(GetBotStatusResponse.parse({
    running: state.running,
    startedAt: state.startedAt?.toISOString() ?? null,
    stoppedAt: state.stoppedAt?.toISOString() ?? null,
  }));
});

router.post("/bot/start", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  const [updated] = await db
    .update(botStateTable)
    .set({ running: true, startedAt: new Date(), stoppedAt: null })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json(StartBotResponse.parse({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
  }));
});

router.post("/bot/stop", async (req, res): Promise<void> => {
  const state = await ensureBotState();
  const [updated] = await db
    .update(botStateTable)
    .set({ running: false, stoppedAt: new Date() })
    .where(eq(botStateTable.id, state.id))
    .returning();

  res.json(StopBotResponse.parse({
    running: updated.running,
    startedAt: updated.startedAt?.toISOString() ?? null,
    stoppedAt: updated.stoppedAt?.toISOString() ?? null,
  }));
});

export default router;
