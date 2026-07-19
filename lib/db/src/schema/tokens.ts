import { pgTable, serial, text, real, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  chain: text("chain").notNull(), // 'solana' | 'bsc'
  address: text("address").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  poolAddress: text("pool_address"),
  liquidityUsd: real("liquidity_usd").notNull().default(0),
  holders: integer("holders").notNull().default(0),
  ageSeconds: integer("age_seconds").notNull().default(0),
  top10Pct: real("top10_pct").notNull().default(0),
  rugScore: real("rug_score").notNull().default(0),
  volumeUsd: real("volume_usd").notNull().default(0),
  priceUsd: real("price_usd"),
  filterPassed: boolean("filter_passed").notNull().default(false),
  failReasons: jsonb("fail_reasons").$type<string[]>(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;
