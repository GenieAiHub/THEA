import { Router } from "express";
import { randomInt } from "node:crypto";
import { formatUnits } from "viem";
import { and, eq, desc, ne, lt, gt, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { depositIntentsTable } from "@workspace/db/schema";
import { requireAuth } from "../../middlewares/auth";
import {
  getOrCreateWallet,
  isRealUserId,
  microToUsd,
  postLedgerEntry,
  usdToMicro,
} from "../../lib/wallet";
import {
  DEPOSIT_COINS,
  getSpotUsdMicro,
  resolveCoin,
  verifyDeposit,
  type DepositCoin,
} from "../../lib/deposits";

const router = Router();
router.use(requireAuth);

/** Minimum / maximum single-deposit size in whole USD. */
const MIN_DEPOSIT_USD = 1n;
const MAX_DEPOSIT_USD = 100_000n;
const INTENT_TTL_MIN = 60;
/** Max simultaneous open (pending, unexpired) intents per user. */
const MAX_OPEN_INTENTS = 20;
/** Cap dust value at ~$0.99 while keeping enough entropy for unique amounts. */
const DUST_USD_CAP = "0.99";

/** True if `e` is a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

function realUserId(req: { thea?: { user: { id: string } } }): string | null {
  const id = req.thea?.user.id;
  return id && isRealUserId(id) ? id : null;
}

function isDepositCoin(v: unknown): v is DepositCoin {
  return typeof v === "string" && (DEPOSIT_COINS as string[]).includes(v);
}

/** GET /v1/wallet/deposit/coins — coins currently available to deposit. */
router.get("/coins", async (req, res) => {
  if (!realUserId(req)) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const coins = [];
  for (const coin of DEPOSIT_COINS) {
    const r = await resolveCoin(coin);
    if (!r) continue;
    const priceMicro = await getSpotUsdMicro(r);
    if (priceMicro == null) continue;
    coins.push({
      coin: r.coin,
      label: r.label,
      chain: r.chain,
      kind: r.kind,
      decimals: r.decimals,
      minConfirmations: r.minConfirmations,
      priceUsd: microToUsd(priceMicro),
    });
  }
  res.json({ data: coins });
});

/** POST /v1/wallet/deposit/intent — quote a deposit and issue a unique amount. */
router.post("/intent", async (req, res) => {
  const userId = realUserId(req);
  if (!userId) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const { coin, amountUsd } = req.body as { coin?: unknown; amountUsd?: unknown };
  if (!isDepositCoin(coin)) {
    res.status(400).json({ error: "Unknown or unsupported coin" });
    return;
  }
  const amountStr = typeof amountUsd === "number" ? amountUsd.toString() : String(amountUsd ?? "");
  if (!/^\d+(\.\d+)?$/.test(amountStr.trim())) {
    res.status(400).json({ error: "amountUsd must be a positive number" });
    return;
  }
  const requestedMicro = usdToMicro(amountStr.trim());
  if (requestedMicro < MIN_DEPOSIT_USD * 1_000_000n || requestedMicro > MAX_DEPOSIT_USD * 1_000_000n) {
    res.status(400).json({
      error: `Deposit must be between $${MIN_DEPOSIT_USD} and $${MAX_DEPOSIT_USD.toLocaleString()}`,
    });
    return;
  }

  const r = await resolveCoin(coin);
  if (!r) {
    res.status(503).json({ error: "This coin is not available for deposits yet" });
    return;
  }
  const priceMicro = await getSpotUsdMicro(r);
  if (priceMicro == null) {
    res.status(503).json({ error: "Pricing is temporarily unavailable — please retry" });
    return;
  }

  const factor = 10n ** BigInt(r.decimals);
  const coinBase = (requestedMicro * factor) / priceMicro;
  if (coinBase <= 0n) {
    res.status(400).json({ error: "Amount is too small for this coin" });
    return;
  }
  // Cap simultaneous open intents so the (necessarily small) dust keyspace can't
  // be brute-forced to mint an amount matching a victim's on-chain transfer.
  const [openRow] = await db
    .select({ n: count() })
    .from(depositIntentsTable)
    .where(
      and(
        eq(depositIntentsTable.userId, userId),
        eq(depositIntentsTable.status, "pending"),
        gt(depositIntentsTable.expiresAt, new Date()),
      ),
    );
  if (Number(openRow?.n ?? 0) >= MAX_OPEN_INTENTS) {
    res.status(429).json({
      error: "You have too many pending deposits — finish or let one expire first",
    });
    return;
  }

  // Dust suffix makes the expected amount unique so a transfer can only satisfy
  // the intent it was created for (verification requires the EXACT amount). A
  // partial unique index on (coin, amount_base_units) WHERE status='pending'
  // guarantees no two live intents share an amount — retry dust on collision.
  let dustMax = (usdToMicro(DUST_USD_CAP) * factor) / priceMicro;
  if (dustMax > 1_000_000n) dustMax = 1_000_000n;
  if (dustMax < 2n) dustMax = 2n;
  const expiresAt = new Date(Date.now() + INTENT_TTL_MIN * 60 * 1000);

  let intent: typeof depositIntentsTable.$inferSelect | undefined;
  for (let attempt = 0; attempt < 16 && !intent; attempt++) {
    const dust = BigInt(randomInt(1, Number(dustMax) + 1));
    const expected = coinBase + dust;
    try {
      [intent] = await db
        .insert(depositIntentsTable)
        .values({
          userId,
          coin: r.coin,
          chain: r.chain,
          kind: r.kind,
          tokenAddress: r.tokenAddress,
          receivingAddress: r.receivingAddress,
          coinDecimals: r.decimals,
          amountDisplay: formatUnits(expected, r.decimals),
          amountBaseUnits: expected.toString(),
          requestedUsd: microToUsd(requestedMicro),
          quotedPriceUsd: microToUsd(priceMicro),
          status: "pending",
          expiresAt,
        })
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) continue; // amount already taken — new dust
      throw e;
    }
  }
  if (!intent) {
    res.status(503).json({ error: "Please retry with a slightly different amount" });
    return;
  }

  res.json({
    data: {
      intentId: intent.id,
      coin: intent.coin,
      chain: intent.chain,
      kind: intent.kind,
      tokenAddress: intent.tokenAddress,
      receivingAddress: intent.receivingAddress,
      amount: intent.amountDisplay,
      amountBaseUnits: intent.amountBaseUnits,
      decimals: intent.coinDecimals,
      priceUsd: microToUsd(priceMicro),
      requestedUsd: microToUsd(requestedMicro),
      minConfirmations: r.minConfirmations,
      expiresAt: expiresAt.toISOString(),
    },
  });
});

/** POST /v1/wallet/deposit/verify — verify a tx hash and credit the wallet. */
router.post("/verify", async (req, res) => {
  const userId = realUserId(req);
  if (!userId) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const { intentId, txHash } = req.body as { intentId?: string; txHash?: string };
  if (!intentId || !txHash) {
    res.status(400).json({ error: "intentId and txHash are required" });
    return;
  }

  const [intent] = await db
    .select()
    .from(depositIntentsTable)
    .where(and(eq(depositIntentsTable.id, intentId), eq(depositIntentsTable.userId, userId)))
    .limit(1);
  if (!intent) {
    res.status(404).json({ error: "Deposit request not found" });
    return;
  }
  if (intent.status === "confirmed") {
    const w = await getOrCreateWallet(userId);
    res.json({
      success: true,
      creditedUsd: microToUsd(intent.creditedMicro ?? 0n),
      balance: microToUsd(w.balanceMicro),
    });
    return;
  }
  if (new Date() > intent.expiresAt) {
    await db
      .update(depositIntentsTable)
      .set({ status: "expired" })
      .where(eq(depositIntentsTable.id, intent.id));
    res.status(410).json({ error: "This deposit request expired — please start a new one" });
    return;
  }

  // Normalize/validate the tx hash for the intent's chain.
  const raw = txHash.trim().toLowerCase();
  const normalized = intent.chain === "bitcoin" ? raw.replace(/^0x/, "") : raw;
  const valid =
    intent.chain === "bitcoin"
      ? /^[0-9a-f]{64}$/.test(normalized)
      : /^0x[0-9a-f]{64}$/.test(normalized);
  if (!valid) {
    res.status(400).json({ error: "That does not look like a valid transaction hash" });
    return;
  }

  // One transaction can back at most one deposit.
  const [used] = await db
    .select({ id: depositIntentsTable.id })
    .from(depositIntentsTable)
    .where(eq(depositIntentsTable.txHash, normalized))
    .limit(1);
  if (used) {
    res.status(409).json({ error: "This transaction has already been used" });
    return;
  }

  // Ambiguity guard: if any OTHER intent shares this exact coin+amount and was
  // created earlier, this transfer cannot be unambiguously attributed to this
  // intent. The pending-amount unique index makes this rare; this also blocks
  // the case where an earlier intent's amount was reissued after it expired.
  const [ambiguous] = await db
    .select({ id: depositIntentsTable.id })
    .from(depositIntentsTable)
    .where(
      and(
        eq(depositIntentsTable.coin, intent.coin),
        eq(depositIntentsTable.amountBaseUnits, intent.amountBaseUnits),
        ne(depositIntentsTable.id, intent.id),
        lt(depositIntentsTable.createdAt, intent.createdAt),
      ),
    )
    .limit(1);
  if (ambiguous) {
    res.status(409).json({
      error: "This deposit amount is ambiguous — please start a new deposit",
    });
    return;
  }

  const r = await resolveCoin(intent.coin as DepositCoin);
  if (!r) {
    res.status(503).json({ error: "This coin is not available for deposits yet" });
    return;
  }

  const result = await verifyDeposit(r, {
    txHash: normalized,
    expectedBaseUnits: BigInt(intent.amountBaseUnits),
    createdAt: intent.createdAt,
  });
  if (!result.ok) {
    res.status(202).json({ pending: true, reason: result.reason });
    return;
  }

  const priceMicro = await getSpotUsdMicro(r);
  if (priceMicro == null) {
    res.status(202).json({ pending: true, reason: "Pricing is temporarily unavailable — please retry" });
    return;
  }
  const factor = 10n ** BigInt(intent.coinDecimals);
  const creditedMicro = (result.valueBaseUnits * priceMicro) / factor; // floor favors the house
  if (creditedMicro <= 0n) {
    res.status(400).json({ error: "Deposit value is too small to credit" });
    return;
  }

  const wallet = await getOrCreateWallet(userId);
  let creditedFinal = creditedMicro;
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(depositIntentsTable)
      .where(eq(depositIntentsTable.id, intent.id))
      .limit(1)
      .for("update");
    if (!locked || locked.status === "confirmed") {
      creditedFinal = locked?.creditedMicro ?? creditedMicro;
      return;
    }
    const posted = await postLedgerEntry(tx, {
      walletId: wallet.id,
      type: "deposit",
      amountMicro: creditedMicro,
      refType: "deposit_tx",
      refId: `${intent.chain}:${normalized}`,
      memo: `Deposit ${intent.coin.toUpperCase()}`,
    });
    if (!posted.applied) {
      // Ref already consumed elsewhere — abort rather than risk double-credit.
      throw new Error(
        `Deposit ref ${intent.chain}:${normalized} already credited`,
      );
    }
    await tx
      .update(depositIntentsTable)
      .set({
        status: "confirmed",
        txHash: normalized,
        creditedMicro,
        creditPriceUsd: microToUsd(priceMicro),
        confirmedAt: new Date(),
      })
      .where(eq(depositIntentsTable.id, intent.id));
  });

  const w = await getOrCreateWallet(userId);
  res.json({
    success: true,
    creditedUsd: microToUsd(creditedFinal),
    balance: microToUsd(w.balanceMicro),
  });
});

/** GET /v1/wallet/deposit/intents — the user's recent deposit requests. */
router.get("/intents", async (req, res) => {
  const userId = realUserId(req);
  if (!userId) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const rows = await db
    .select()
    .from(depositIntentsTable)
    .where(eq(depositIntentsTable.userId, userId))
    .orderBy(desc(depositIntentsTable.createdAt))
    .limit(limit);

  res.json({
    data: rows.map((r) => ({
      id: r.id,
      coin: r.coin,
      chain: r.chain,
      amount: r.amountDisplay,
      requestedUsd: r.requestedUsd,
      status: r.status,
      txHash: r.txHash,
      creditedUsd: r.creditedMicro != null ? microToUsd(r.creditedMicro) : null,
      expiresAt: r.expiresAt.toISOString(),
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
