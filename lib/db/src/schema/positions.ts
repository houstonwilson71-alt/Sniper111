import { pgTable, serial, integer, real, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenAddress: text("token_address").notNull(),
  chain: text("chain").notNull(),
  entryPriceUsd: real("entry_price_usd").notNull(),
  currentPriceUsd: real("current_price_usd").notNull(),
  peakPriceUsd: real("peak_price_usd").notNull(),
  sizeUsd: real("size_usd").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  tp1Hit: boolean("tp1_hit").notNull().default(false),
  tp2Hit: boolean("tp2_hit").notNull().default(false),
  trailingStopActive: boolean("trailing_stop_active").notNull().default(false),
  stopLossPrice: real("stop_loss_price"),
  unrealisedPnlUsd: real("unrealised_pnl_usd").notNull().default(0),
  unrealisedPnlPct: real("unrealised_pnl_pct").notNull().default(0),
  realisedPnlUsd: real("realised_pnl_usd"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;
