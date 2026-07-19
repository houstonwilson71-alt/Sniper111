import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenAddress: text("token_address").notNull(),
  chain: text("chain").notNull(),
  positionId: integer("position_id"),
  side: text("side").notNull(), // 'buy' | 'sell'
  amountUsd: real("amount_usd").notNull(),
  priceUsd: real("price_usd").notNull(),
  txHash: text("tx_hash").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'failed'
  feesUsd: real("fees_usd"),
  pnlUsd: real("pnl_usd"),
  pnlPct: real("pnl_pct"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
