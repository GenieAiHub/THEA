import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  bigint,
  integer,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A custodial crypto deposit intent for the real-money markets wallet.
 *
 * Deposits use the same shared-address + unique-amount model as the crypto
 * subscription flow, but bind to a real end-user (not an org) and credit a
 * single USD-pegged custodial balance:
 *
 *   1. The user asks to deposit ~$X in a given coin (BTC / ETH / BSC-USDT / CG).
 *   2. We quote the coin at spot and issue a UNIQUE dust-suffixed expected
 *      amount to a THEA receiving wallet, e.g. "0.00340017 ETH".
 *   3. The user sends EXACTLY that amount and submits the transaction hash.
 *   4. We verify an on-chain transfer of the EXACT amount to our address, then
 *      credit `credited_micro` (= received base units × spot price at
 *      confirmation, floored) to the user's wallet via the ledger.
 *
 * `tx_hash` is UNIQUE so one transfer cannot satisfy two intents; the ledger's
 * (type, ref_type, ref_id) idempotency is the final replay guard.
 */
export const depositIntentsTable = pgTable(
  "deposit_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // 'btc' | 'eth' | 'bsc_usdt' | 'cg'
    coin: text("coin").notNull(),
    // 'bitcoin' | 'ethereum' | 'bsc'
    chain: text("chain").notNull(),
    // 'native' | 'erc20'
    kind: text("kind").notNull(),
    // ERC-20/BEP-20 token contract (lowercased) for token coins; null for native.
    tokenAddress: text("token_address"),
    // THEA receiving wallet address (lowercased for EVM; case-preserved for BTC).
    receivingAddress: text("receiving_address").notNull(),
    coinDecimals: integer("coin_decimals").notNull(),
    // Human-readable expected amount incl. dust, e.g. "0.00340017".
    amountDisplay: text("amount_display").notNull(),
    // Expected amount in coin base units incl. dust, as a decimal string.
    amountBaseUnits: text("amount_base_units").notNull(),
    // USD amount the user asked to deposit, e.g. "50".
    requestedUsd: text("requested_usd").notNull(),
    // Spot price (USD per 1 coin) quoted at intent creation, for display.
    quotedPriceUsd: text("quoted_price_usd").notNull(),
    // 'pending' | 'confirmed' | 'expired' | 'failed'
    status: text("status").notNull().default("pending"),
    // On-chain transaction hash (lowercased) once submitted / verified.
    txHash: text("tx_hash"),
    // Micro-USD actually credited to the wallet on confirmation.
    creditedMicro: bigint("credited_micro", { mode: "bigint" }),
    // Spot price (USD per 1 coin) used to compute the credit at confirmation.
    creditPriceUsd: text("credit_price_usd"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("deposit_intent_txhash_uq").on(table.txHash),
    // At most one LIVE (pending) intent may hold a given expected amount, so a
    // transfer to a SHARED deposit address can only ever satisfy the intent it
    // was minted for. This closes the amount-collision theft vector where an
    // attacker mints an intent matching a victim's on-chain amount.
    uniqueIndex("deposit_intent_pending_amount_uq")
      .on(table.coin, table.amountBaseUnits)
      .where(sql`${table.status} = 'pending'`),
    index("deposit_intent_user_idx").on(table.userId),
    index("deposit_intent_status_idx").on(table.status),
  ],
);

export const insertDepositIntentSchema = createInsertSchema(depositIntentsTable).omit({
  id: true,
  createdAt: true,
});
export const selectDepositIntentSchema = createSelectSchema(depositIntentsTable);
export type InsertDepositIntent = z.infer<typeof insertDepositIntentSchema>;
export type DepositIntent = typeof depositIntentsTable.$inferSelect;
