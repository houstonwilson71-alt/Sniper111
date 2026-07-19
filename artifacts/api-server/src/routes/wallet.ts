import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, walletConfigTable, botStateTable } from "@workspace/db";
import { encrypt, decrypt, isEncrypted } from "../lib/crypto";

const router: IRouter = Router();

async function ensureWalletConfig() {
  const rows = await db.select().from(walletConfigTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(walletConfigTable).values({}).returning();
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

router.get("/wallet", async (req, res): Promise<void> => {
  const cfg = await ensureWalletConfig();
  const state = await ensureBotState();
  res.json({
    solanaPrivateKey: cfg.solanaPrivateKey ? "[encrypted]" : null,
    bscPrivateKey: cfg.bscPrivateKey ? "[encrypted]" : null,
    useWalletConnect: cfg.useWalletConnect,
    liveTradingEnabled: state.liveTradingEnabled,
  });
});

router.put("/wallet", async (req, res): Promise<void> => {
  const { solanaPrivateKey, bscPrivateKey, useWalletConnect } = req.body || {};
  const cfg = await ensureWalletConfig();

  const update: Partial<typeof walletConfigTable.$inferInsert> = {};

  if (solanaPrivateKey !== undefined) {
    if (solanaPrivateKey) {
      const encrypted = encrypt(solanaPrivateKey);
      update.solanaPrivateKey = encrypted || solanaPrivateKey; // fallback to plaintext if no key
    } else {
      update.solanaPrivateKey = null;
    }
  }
  if (bscPrivateKey !== undefined) {
    if (bscPrivateKey) {
      const encrypted = encrypt(bscPrivateKey);
      update.bscPrivateKey = encrypted || bscPrivateKey; // fallback to plaintext if no key
    } else {
      update.bscPrivateKey = null;
    }
  }
  if (useWalletConnect !== undefined) update.useWalletConnect = useWalletConnect;

  const [updated] = await db
    .update(walletConfigTable)
    .set(update)
    .where(eq(walletConfigTable.id, cfg.id))
    .returning();

  const state = await ensureBotState();
  const live = process.env.LIVE_TRADING_ENABLED === "true";
  await db
    .update(botStateTable)
    .set({ liveTradingEnabled: live })
    .where(eq(botStateTable.id, state.id))
    .execute();

  res.json({
    solanaPrivateKey: updated.solanaPrivateKey ? "[encrypted]" : null,
    bscPrivateKey: updated.bscPrivateKey ? "[encrypted]" : null,
    useWalletConnect: updated.useWalletConnect,
    liveTradingEnabled: live,
  });
});

// Internal endpoint for executors to fetch decrypted keys (protected by API token in production)
router.get("/wallet/decrypted", async (req, res): Promise<void> => {
  const token = req.headers["x-internal-api-token"];
  if (!token || token !== process.env.INTERNAL_API_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const cfg = await ensureWalletConfig();
  res.json({
    solanaPrivateKey: cfg.solanaPrivateKey && isEncrypted(cfg.solanaPrivateKey) ? decrypt(cfg.solanaPrivateKey) : cfg.solanaPrivateKey,
    bscPrivateKey: cfg.bscPrivateKey && isEncrypted(cfg.bscPrivateKey) ? decrypt(cfg.bscPrivateKey) : cfg.bscPrivateKey,
  });
});

export default router;
