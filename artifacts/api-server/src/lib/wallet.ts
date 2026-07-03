import { db } from "@workspace/db";
import { walletsTable, ledgerEntriesTable, type Wallet } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

/** Micro-USD accounting: 1_000_000 micro = $1 (matches USDT 6-decimals). */
export const USD_MICRO = 1_000_000n;

/** The transaction handle drizzle passes to `db.transaction(async (tx) => …)`. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LedgerType =
  | "deposit"
  | "withdrawal_hold"
  | "withdrawal_refund"
  | "trade_buy"
  | "trade_sell"
  | "payout"
  | "refund"
  | "adjustment";

export class InsufficientFundsError extends Error {
  constructor(message = "Insufficient balance") {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

/** Format a signed micro-USD integer as a plain decimal string, e.g. 1500000n → "1.5". */
export function microToUsd(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / USD_MICRO;
  const frac = (abs % USD_MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? "." + frac : ""}`;
}

/** Parse a USD decimal string/number (e.g. "12.5") into micro-USD base units. */
export function usdToMicro(usd: string | number): bigint {
  const s = (typeof usd === "number" ? usd.toString() : usd).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid USD amount: ${usd}`);
  const neg = s.startsWith("-");
  const [whole, frac = ""] = (neg ? s.slice(1) : s).split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  const micro = BigInt(whole) * USD_MICRO + BigInt(fracPadded);
  return neg ? -micro : micro;
}

/**
 * API-key sessions authenticate as a synthetic user id `apik:<id>` that has no
 * row in `users` — so it can never own a wallet. Wallet/trading endpoints must
 * reject these and require a real logged-in consumer account.
 */
export function isRealUserId(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}

/** Fetch (or lazily create) the wallet for a real user id. */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  await db.insert(walletsTable).values({ userId }).onConflictDoNothing({ target: walletsTable.userId });
  const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (!w) throw new Error("failed to create wallet");
  return w;
}

export interface PostEntryInput {
  walletId: string;
  type: LedgerType;
  /** Signed micro-USD delta: credit > 0, debit < 0. */
  amountMicro: bigint;
  refType?: string | null;
  refId?: string | null;
  memo?: string | null;
}

export interface PostEntryResult {
  applied: boolean;
  balanceAfter: bigint;
  entryId: string | null;
}

/**
 * Post a single signed ledger entry against a wallet INSIDE an existing
 * transaction. Locks the wallet row `FOR UPDATE`, enforces a non-negative
 * balance, writes the running-balance snapshot, and is idempotent on
 * `(type, refType, refId)`: a repeated ref is a no-op that returns the prior
 * balance without moving money.
 *
 * Callers that touch multiple locked rows (e.g. AMM state + wallet) must always
 * acquire locks in the same order across the codebase to avoid deadlocks.
 */
export async function postLedgerEntry(tx: DbTx, input: PostEntryInput): Promise<PostEntryResult> {
  if (input.refType && input.refId) {
    const existing = await tx
      .select({ id: ledgerEntriesTable.id, balanceAfter: ledgerEntriesTable.balanceAfter })
      .from(ledgerEntriesTable)
      .where(
        and(
          eq(ledgerEntriesTable.type, input.type),
          eq(ledgerEntriesTable.refType, input.refType),
          eq(ledgerEntriesTable.refId, input.refId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return { applied: false, balanceAfter: existing[0].balanceAfter, entryId: existing[0].id };
    }
  }

  const [wallet] = await tx
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.id, input.walletId))
    .limit(1)
    .for("update");
  if (!wallet) throw new Error("wallet not found");

  const balanceAfter = wallet.balanceMicro + input.amountMicro;
  if (balanceAfter < 0n) throw new InsufficientFundsError();

  await tx
    .update(walletsTable)
    .set({ balanceMicro: balanceAfter, updatedAt: new Date() })
    .where(eq(walletsTable.id, input.walletId));

  const [entry] = await tx
    .insert(ledgerEntriesTable)
    .values({
      walletId: input.walletId,
      type: input.type,
      amountMicro: input.amountMicro,
      balanceAfter,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      memo: input.memo ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: ledgerEntriesTable.id });

  if (!entry) {
    // Idempotency guard lost a race despite the pre-check — abort so the
    // balance UPDATE above rolls back with the surrounding transaction.
    throw new Error("Ledger idempotency conflict — entry already exists");
  }

  return { applied: true, balanceAfter, entryId: entry.id };
}
