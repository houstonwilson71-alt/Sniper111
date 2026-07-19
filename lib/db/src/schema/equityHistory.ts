import { pgTable, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equityHistoryTable = pgTable("equity_history", {
  id: serial("id").primaryKey(),
  equityUsd: real("equity_usd").notNull(),
  pnlUsd: real("pnl_usd").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEquityHistorySchema = createInsertSchema(equityHistoryTable).omit({ id: true });
export type InsertEquityHistory = z.infer<typeof insertEquityHistorySchema>;
export type EquityHistory = typeof equityHistoryTable.$inferSelect;
