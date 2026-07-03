import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { db } from "@workspace/db";
import { ledgerEntriesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getOrCreateWallet, isRealUserId, microToUsd } from "../../lib/wallet";

const router = Router();

router.use(requireAuth);

/** GET /v1/wallet — the authenticated user's custodial balance. */
router.get("/", async (req, res) => {
  const userId = req.thea!.user.id;
  if (!isRealUserId(userId)) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const wallet = await getOrCreateWallet(userId);
  res.json({
    data: {
      id: wallet.id,
      balance: microToUsd(wallet.balanceMicro),
      balanceMicro: wallet.balanceMicro.toString(),
      currency: "USDT",
      updatedAt: wallet.updatedAt.toISOString(),
    },
  });
});

/** GET /v1/wallet/ledger — recent ledger history (most recent first). */
router.get("/ledger", async (req, res) => {
  const userId = req.thea!.user.id;
  if (!isRealUserId(userId)) {
    res.status(403).json({ error: "Wallet is not available for API-key sessions" });
    return;
  }
  const wallet = await getOrCreateWallet(userId);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));

  const rows = await db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.walletId, wallet.id))
    .orderBy(desc(ledgerEntriesTable.createdAt))
    .limit(limit);

  res.json({
    data: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: microToUsd(r.amountMicro),
      amountMicro: r.amountMicro.toString(),
      balanceAfter: microToUsd(r.balanceAfter),
      balanceAfterMicro: r.balanceAfter.toString(),
      refType: r.refType,
      refId: r.refId,
      memo: r.memo,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
