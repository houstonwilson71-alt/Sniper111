import { pgTable, serial, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botStateTable = pgTable("bot_state", {
  id: serial("id").primaryKey(),
  running: boolean("running").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  error: text("error"),
  emergencyStopped: boolean("emergency_stopped").notNull().default(false),
  liveTradingEnabled: boolean("live_trading_enabled").notNull().default(false),
  walletAddress: text("wallet_address"),
});

export const insertBotStateSchema = createInsertSchema(botStateTable).omit({ id: true });
export type InsertBotState = z.infer<typeof insertBotStateSchema>;
export type BotState = typeof botStateTable.$inferSelect;
