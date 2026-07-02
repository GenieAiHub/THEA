import { pgTable, text, timestamp, uuid, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * A pending (or resolved) on-chain USDT payment intent.
 *
 * Web3 crypto payments have no trusted callback: the customer sends USDT to a
 * THEA receiving wallet and then tells us the transaction hash. To bind a given
 * transaction to a specific org + plan (and defeat someone claiming another
 * user's transaction), each intent is issued a UNIQUE dust-suffixed amount
 * (e.g. 99.412345 USDT). Verification then requires an on-chain Transfer of at
 * least that exact odd amount, to our address, within the intent's time window.
 *
 * Actual tier granting still funnels through activateSubscription(), whose
 * payments(provider, provider_ref=txHash) UNIQUE constraint is the final
 * replay guard. `tx_hash` here is also unique so one transfer cannot satisfy
 * two intents.
 */
export const cryptoPaymentIntentsTable = pgTable(
  "crypto_payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // 'professional' | 'business' | 'political'
    planKey: text("plan_key").notNull(),
    // Resolved internal tier: 'starter' | 'pro' | 'enterprise'
    tier: text("tier").notNull(),
    // 'monthly' | 'annual'
    interval: text("interval").notNull(),
    // e.g. 'polygon'
    chain: text("chain").notNull(),
    // ERC-20 USDT contract address on `chain` (lowercased).
    tokenAddress: text("token_address").notNull(),
    // THEA receiving wallet address (lowercased).
    receivingAddress: text("receiving_address").notNull(),
    // Human-readable expected amount incl. dust suffix, e.g. "99.412345".
    amountDisplay: text("amount_display").notNull(),
    // Expected amount in token base units (6-dp USDT), as a decimal string to
    // avoid bigint/JSON precision loss, e.g. "99412345".
    amountBaseUnits: text("amount_base_units").notNull(),
    currency: text("currency").notNull().default("USDT"),
    // 'pending' | 'confirmed' | 'expired'
    status: text("status").notNull().default("pending"),
    // On-chain transaction hash (lowercased) once verified.
    txHash: text("tx_hash"),
    expiresAt: timestamp("expires_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("crypto_intent_txhash_uq").on(table.txHash),
    index("crypto_intent_org_idx").on(table.orgId),
    index("crypto_intent_status_idx").on(table.status),
  ],
);

export const insertCryptoPaymentIntentSchema = createInsertSchema(cryptoPaymentIntentsTable).omit({
  id: true,
  createdAt: true,
});
export const selectCryptoPaymentIntentSchema = createSelectSchema(cryptoPaymentIntentsTable);
export type InsertCryptoPaymentIntent = z.infer<typeof insertCryptoPaymentIntentSchema>;
export type CryptoPaymentIntent = typeof cryptoPaymentIntentsTable.$inferSelect;
