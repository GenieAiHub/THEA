import { pgTable, text, timestamp, uuid, bigint, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

/**
 * Custodial user wallet for THEA Markets (real-money crypto prediction market).
 *
 * The platform takes custody of user crypto deposits and tracks a single
 * USD-pegged balance per user in **micro-USD** integer base units
 * (1_000_000 micro = $1, matching USDT's 6 decimals). Integer base units in an
 * int8 column give us exact SQL arithmetic (`balance = balance + delta`),
 * `FOR UPDATE` row locking, and a `CHECK (balance >= 0)` guard — none of which
 * are possible with the text-amount convention used for one-shot subscription
 * payments. Amounts are serialised to strings at the API boundary so JSON never
 * loses precision.
 */
export const walletsTable = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** USD-pegged custodial balance, micro-USD (1e6 = $1). Never negative. */
    balanceMicro: bigint("balance_micro", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("wallets_balance_nonneg", sql`${table.balanceMicro} >= 0`)],
);

/**
 * Append-only double-entry-style ledger. Every balance mutation (deposit,
 * trade, payout, withdrawal hold/refund) writes one row with the signed delta
 * and a running-balance snapshot (`balanceAfter`) for audit.
 *
 * `(type, refType, refId)` is UNIQUE and acts as the idempotency guard: the same
 * on-chain deposit tx hash, position payout, or withdrawal can never be applied
 * twice. Rows without a ref (manual adjustments) are allowed to repeat because
 * Postgres treats NULLs as distinct in a unique index.
 */
export const ledgerEntriesTable = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => walletsTable.id, { onDelete: "cascade" }),
    // deposit | withdrawal_hold | withdrawal_refund | trade_buy | trade_sell | payout | refund | adjustment
    type: text("type").notNull(),
    /** Signed micro-USD delta: credit > 0, debit < 0. */
    amountMicro: bigint("amount_micro", { mode: "bigint" }).notNull(),
    /** Wallet balance immediately after applying this entry. */
    balanceAfter: bigint("balance_after", { mode: "bigint" }).notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ledger_entries_ref_uq").on(table.type, table.refType, table.refId),
    index("ledger_entries_wallet_idx").on(table.walletId, table.createdAt),
  ],
);

export type Wallet = typeof walletsTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
