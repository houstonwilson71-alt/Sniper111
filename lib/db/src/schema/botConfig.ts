import { pgTable, serial, boolean, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botConfigTable = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  enableSolana: boolean("enable_solana").notNull().default(true),
  enableBsc: boolean("enable_bsc").notNull().default(true),
  minLiquidityUsd: real("min_liquidity_usd").notNull().default(5000),
  maxAgeSeconds: integer("max_age_seconds").notNull().default(300),
  minHolders: integer("min_holders").notNull().default(25),
  maxTop10Pct: real("max_top10_pct").notNull().default(35),
  maxRugScore: real("max_rug_score").notNull().default(2),
  minVolumeUsd: real("min_volume_usd").notNull().default(1000),
  buyAmountUsd: real("buy_amount_usd").notNull().default(50),
  slippageBps: integer("slippage_bps").notNull().default(1500),
  tp1Pct: real("tp1_pct").notNull().default(100),
  tp1SellPct: real("tp1_sell_pct").notNull().default(50),
  tp2Pct: real("tp2_pct").notNull().default(500),
  tp2SellPct: real("tp2_sell_pct").notNull().default(50),
  trailingStopPct: real("trailing_stop_pct").notNull().default(25),
  timeExitMinutes: integer("time_exit_minutes").notNull().default(120),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotConfigSchema = createInsertSchema(botConfigTable).omit({ id: true, updatedAt: true });
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type BotConfig = typeof botConfigTable.$inferSelect;
