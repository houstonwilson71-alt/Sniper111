import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletConfigTable = pgTable("wallet_config", {
  id: serial("id").primaryKey(),
  solanaPrivateKey: text("solana_private_key"),
  bscPrivateKey: text("bsc_private_key"),
  useWalletConnect: boolean("use_wallet_connect").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWalletConfigSchema = createInsertSchema(walletConfigTable).omit({ id: true, updatedAt: true });
export type InsertWalletConfig = z.infer<typeof insertWalletConfigSchema>;
export type WalletConfig = typeof walletConfigTable.$inferSelect;
