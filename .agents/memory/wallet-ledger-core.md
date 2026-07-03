---
name: Custodial wallet + ledger core (THEA Markets real-money)
description: Money accounting model, drizzle bigint gotchas, and idempotency design for the custodial prediction-market wallet.
---

# Custodial Wallet + Ledger Core

## Accounting unit
Wallet balances use **bigint micro-USD** (`bigint(..., { mode: "bigint" })`, 1_000_000 = $1, USDT 6-decimals) — NOT the text-amount base-unit convention used by `payments.amount` / `crypto_payment_intents`.

**Why:** an int8 column gives exact SQL arithmetic (`balance = balance + delta`), `FOR UPDATE` row locking, and a `CHECK (balance >= 0)` guard — none possible with text amounts. The text convention exists only to avoid JSON float precision loss on one-shot subscription payments; we get the same wire-safety by serialising bigint → string at the API boundary (`microToUsd`).

**How to apply:** all money columns (balances, ledger deltas, AMM/positions/withdrawals in later phases) are bigint micro-USD; every API field carrying money is `type: string` in openapi.yaml and emitted via `microToUsd()` in `artifacts/api-server/src/lib/wallet.ts`.

## drizzle-kit push BigInt default gotcha
Never give a bigint column a BigInt-literal default like `.default(0n)`. `drizzle-kit push` JSON.stringifies its schema snapshot and dies with `TypeError: Do not know how to serialize a BigInt`. Use a SQL default: `.default(sql\`0\`)`.

**Why:** drizzle-kit's snapshot serializer has no BigInt handler; the literal reaches JSON.stringify unchanged.

## Idempotency
`ledger_entries` has `uniqueIndex(type, ref_type, ref_id)`. Rows with NULL ref repeat freely (Postgres NULLs are distinct in a unique index) — used for manual adjustments. `postLedgerEntry(tx, …)` pre-checks the ref under the wallet `FOR UPDATE` lock and returns `{applied:false}` on a repeat, so the same deposit txHash / position payout / withdrawal can never move money twice. If the final insert still hits the unique index (race), it throws to roll back the balance update.

## API-key sessions have no wallet
API-key auth resolves to a synthetic user id `apik:<id>` with no `users` row. `isRealUserId()` (uuid regex) rejects these from all wallet/trade endpoints — a wallet FK to a non-existent user would fail anyway.

## Lock order (applies to all later money flows)
Fixed global lock order to avoid deadlocks: **amm_state → wallet → position**. `postLedgerEntry` locks the wallet row; callers that also lock amm_state/position must acquire amm_state first.
