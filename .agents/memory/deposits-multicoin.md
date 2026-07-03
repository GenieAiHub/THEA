---
name: Multi-coin custodial deposits (THEA Markets real-money)
description: How BTC/ETH/BSC-USDT/CG deposits credit the USD-pegged wallet — config model, anti-theft exact-match, pricing, idempotency.
---

# Multi-coin Custodial Deposits

Four coins credit ONE USD-pegged custodial wallet (`lib/deposits.ts` + `routes/v1/deposits.ts`, mounted at `/v1/wallet/deposit`):
- `btc` native — verified via **mempool.space** (keyless HTTP, no RPC needed)
- `eth` native — verified via viem on Ethereum mainnet (needs RPC)
- `bsc_usdt` BEP-20 USDT on BSC — price = $1
- `cg` Crypto Genie BEP-20 on BSC — **admin-set USD rate** (no reliable market feed)

## Everything is platform_config-driven
A coin is simply "not available" until its config is set (`resolveCoin` returns null → hidden from `/coins`, 503 on intent). Keys: `btc_receiving_address`; `eth_receiving_address` + `eth_rpc_url`; `bsc_receiving_address` (SHARED by usdt+cg) + `bsc_rpc_url`; `bsc_usdt_address` (default 0x55d398…) + `bsc_usdt_decimals`; `cg_token_address` + `cg_token_decimals` + `cg_price_usd`. Optional market overrides: `btc_price_usd`, `eth_price_usd`. min-confirmations: `{btc,eth,bsc}_min_confirmations`. Env fallback works (UPPER_SNAKE) via getPlatformConfig.

**User must still supply (as admin config, not code):** CG BEP-20 contract address + decimals + `cg_price_usd`; real BTC/ETH/BSC receiving addresses; ETH + BSC RPC URLs. Until then those coins are inert. (cryptogenieai.com/cg-token is a JS SPA with no on-chain details in static HTML — can't be scraped.)

## BSC-USDT is 18 decimals
BSC (BEP-20) USDT uses **18** decimals, unlike Ethereum/Polygon USDT (6). Default in the registry is 18; don't assume 6.

## Anti-theft: EXACT-amount match (deviation from the subscription flow)
Deposit verification requires `value === expectedBaseUnits` (EXACT), NOT the `value >= expected` used by `verifyUsdtPayment` in the subscription crypto flow.
**Why:** deposit addresses are shared and deposit amounts are user-chosen. With `>=`, an attacker could create a tiny-amount intent and submit a *victim's* larger transfer to the same address (value ≥ tiny expected ✓, to our address ✓, mined after intent ✓) and steal the credit. The unique dust suffix + exact match binds one transfer to exactly one intent.
**How to apply:** any future shared-address open-deposit verifier must exact-match a dust-unique amount. The user is told to send EXACTLY the displayed amount.

**Hardening (required, not optional):** exact-match + dust alone is NOT enough — BTC dust keyspace is tiny (~$0.99 ≈ 990 sats at high prices), brute-forceable. The real guards are DB-level:
- Partial unique index `deposit_intent_pending_amount_uq` on (coin, amount_base_units) WHERE status='pending' → at most one LIVE intent per amount; POST /intent retries dust on 23505.
- Per-user open-intent cap (`MAX_OPEN_INTENTS`) → blocks brute-forcing the keyspace.
- Verify-time ambiguity guard → reject if any OTHER intent with the same coin+amount was createdAt-earlier (covers expiry-recycle).
- Tight BTC "predates" window (15 min, matches EVM) + higher min-confirmations default (3) so an attacker can't claim a tx mined before their intent existed.
- postLedgerEntry `applied:false` is treated as an error inside the credit tx (must never silently skip a credit/double-credit).

## Dust scaling
Dust is scaled per coin to be worth ≤ ~$0.99: `dustMax = usdToMicro("0.99") * 10^decimals / priceMicro`, capped at 1e6. Prevents BTC dust (8-dp, high unit value) from being worth hundreds of dollars while keeping amounts unique.

## Credit = received × spot AT CONFIRMATION (floored)
`creditedMicro = valueBaseUnits * priceMicroPerCoin / 10^decimals` (bigint floor, favors house). Priced at confirmation, not at quote — volatile coins may credit slightly more/less than the requested USD (honest exchange behavior). Stored on the intent as `creditedMicro` + `creditPriceUsd`.

## Idempotency / races
`deposit_intents.tx_hash` UNIQUE (one transfer → one intent) + ledger ref `${chain}:${txHash}` (type `deposit`, refType `deposit_tx`). The credit runs in a tx that re-selects the intent `FOR UPDATE` and bails if already `confirmed`, so concurrent verify calls can't double-credit.

## Pricing
CoinGecko `simple/price` (keyless), 60s in-process cache. An admin override config value (`*_price_usd`) always wins over the live feed; `cg` has manual pricing only (`getSpotUsdMicro` returns null if `cg_price_usd` unset).
