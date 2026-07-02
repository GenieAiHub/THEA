import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { type Tier } from "../../middlewares/featureGate";
import { createCheckoutSession, createBillingPortalSession, getStripeClient } from "../../lib/stripe";
import {
  planFromKey,
  priceIdForPlan,
  amountForPlan,
  isPlanKey,
  PLANS,
  PLAN_TO_TIER,
  type BillingInterval,
} from "../../lib/plans";
import { createPaypalOrder, capturePaypalOrder, isPaypalConfigured } from "../../lib/paypal";
import { getCryptoConfig, verifyUsdtPayment, formatUsdt } from "../../lib/cryptoPayments";
import { activateSubscription } from "../../lib/subscriptionService";
import { getPlatformConfig } from "../../lib/platform-config";
import { db } from "@workspace/db";
import { subscriptionsTable, cryptoPaymentIntentsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { logger } from "../../lib/logger";

/** End of the current billing cycle for a single up-front (PayPal/crypto) charge. */
function periodEndFor(interval: BillingInterval): Date {
  const d = new Date();
  if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

const router = Router();

router.use(requireAuth);

/** Resolve the six Stripe price IDs (DB-backed, env fallback) for the plan UI. */
async function resolveTierPrices(): Promise<Record<Tier, Record<BillingInterval, string>>> {
  const [sm, sa, pm, pa, em, ea] = await Promise.all([
    getPlatformConfig("stripe_starter_monthly_price_id"),
    getPlatformConfig("stripe_starter_annual_price_id"),
    getPlatformConfig("stripe_pro_monthly_price_id"),
    getPlatformConfig("stripe_pro_annual_price_id"),
    getPlatformConfig("stripe_enterprise_monthly_price_id"),
    getPlatformConfig("stripe_enterprise_annual_price_id"),
  ]);
  return {
    starter: { monthly: sm ?? "", annual: sa ?? "" },
    pro: { monthly: pm ?? "", annual: pa ?? "" },
    enterprise: { monthly: em ?? "", annual: ea ?? "" },
  };
}

const TIER_DISPLAY = {
  starter: { name: "Starter", priceMonthly: 99, priceAnnual: 79 },
  pro: { name: "Pro", priceMonthly: 499, priceAnnual: 399 },
  enterprise: { name: "Enterprise", priceMonthly: 1999, priceAnnual: 1599 },
};

/** All billing reads: any authenticated user (analysts see plan info) */
router.get("/plan", async (req, res) => {
  const { subscription, tier } = req.thea!;
  const display = TIER_DISPLAY[tier] ?? TIER_DISPLAY.starter;
  const tierPrices = await resolveTierPrices();

  res.json({
    data: {
      tier,
      name: display.name,
      priceMonthly: display.priceMonthly,
      priceAnnual: display.priceAnnual,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd === "true",
      maxKeywords: subscription.maxKeywords,
      maxCategories: subscription.maxCategories,
      historyDays: subscription.historyDays,
      availablePlans: Object.entries(TIER_DISPLAY).map(([t, d]) => ({
        tier: t,
        ...d,
        prices: tierPrices[t as Tier],
      })),
      // Audience-facing PR packages (what the marketing site + settings sell).
      packages: Object.values(PLANS).map((p) => ({
        key: p.key,
        tier: p.tier,
        name: p.name,
        segment: p.segment,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        current: p.tier === tier,
      })),
    },
  });
});

router.get("/invoices", requireRole("owner", "admin"), async (req, res) => {
  const { subscription } = req.thea!;
  const customerId = subscription.stripeCustomerId;

  if (!customerId) {
    res.json({ data: [] });
    return;
  }

  try {
    const stripe = await getStripeClient();
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 24 });
    res.json({
      data: invoices.data.map((inv) => ({
        id: inv.id,
        amountPaid: inv.amount_paid,
        amountDue: inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        created: new Date(inv.created * 1000).toISOString(),
        periodStart: new Date(inv.period_start * 1000).toISOString(),
        periodEnd: new Date(inv.period_end * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("STRIPE_SECRET_KEY")) {
      res.json({ data: [] });
      return;
    }
    logger.error({ err }, "Invoices fetch failed");
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/** Checkout and portal are owner/admin only — analysts cannot initiate billing changes */
router.post("/checkout", requireRole("owner", "admin"), async (req, res) => {
  const { planKey, interval, successUrl, cancelUrl } = req.body as {
    planKey?: string;
    interval?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!planKey || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "planKey, successUrl, and cancelUrl are required" });
    return;
  }

  const plan = planFromKey(planKey);
  if (!plan) {
    res.status(400).json({ error: "Unknown plan" });
    return;
  }

  // Interval + price are resolved server-side from the plan key so a client can
  // never pass an arbitrary Stripe priceId to buy a tier it did not pay for.
  const billingInterval: BillingInterval = interval === "annual" ? "annual" : "monthly";
  const priceId = await priceIdForPlan(plan.key, billingInterval);
  if (!priceId) {
    res.status(503).json({ error: "Card checkout is not configured for this plan yet" });
    return;
  }

  try {
    const url = await createCheckoutSession(req.thea!.org.id, priceId, successUrl, cancelUrl);
    res.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe checkout failed";
    if (msg.includes("STRIPE_SECRET_KEY")) {
      res.status(503).json({ error: "Payment processing is not yet configured" });
      return;
    }
    logger.error({ err }, "Checkout session creation failed");
    res.status(500).json({ error: msg });
  }
});

router.post("/portal", requireRole("owner", "admin"), async (req, res) => {
  const { returnUrl } = req.body as { returnUrl?: string };
  const fallbackReturnUrl = `${req.headers.origin || "https://app.thea.ai"}/settings/billing`;

  try {
    const url = await createBillingPortalSession(req.thea!.org.id, returnUrl || fallbackReturnUrl);
    res.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Portal session failed";
    if (msg.includes("No Stripe customer") || msg.includes("STRIPE_SECRET_KEY")) {
      res.status(404).json({ error: "No billing account found — please subscribe to a plan first" });
      return;
    }
    logger.error({ err }, "Billing portal session creation failed");
    res.status(500).json({ error: msg });
  }
});

/**
 * Which payment methods are usable right now (drives the checkout UI). Card is
 * "available" once Stripe price IDs are configured; PayPal / crypto once their
 * respective secrets / wallet are set. Unconfigured methods are simply hidden.
 */
router.get("/config", async (_req, res) => {
  const [starterCard, businessCard, politicalCard] = await Promise.all([
    priceIdForPlan("professional", "monthly"),
    priceIdForPlan("business", "monthly"),
    priceIdForPlan("political", "monthly"),
  ]);
  const card = Boolean(starterCard && businessCard && politicalCard);

  const [cfg, paypalReady, paypalClientId] = await Promise.all([
    getCryptoConfig(),
    isPaypalConfigured(),
    // PayPal client id is public (used by the browser SDK) — safe to expose.
    getPlatformConfig("paypal_client_id"),
  ]);
  res.json({
    data: {
      card,
      paypal: paypalReady,
      paypalClientId: paypalClientId ?? null,
      crypto: cfg !== null,
      cryptoChain: cfg?.chain ?? null,
    },
  });
});

/** PayPal — create an order for a plan (amount resolved server-side). */
router.post("/paypal/order", requireRole("owner", "admin"), async (req, res) => {
  const { planKey, interval } = req.body as { planKey?: string; interval?: string };
  const plan = planKey ? planFromKey(planKey) : null;
  if (!plan) {
    res.status(400).json({ error: "Unknown plan" });
    return;
  }
  if (!(await isPaypalConfigured())) {
    res.status(503).json({ error: "PayPal is not configured yet" });
    return;
  }
  const billingInterval: BillingInterval = interval === "annual" ? "annual" : "monthly";
  try {
    const orderId = await createPaypalOrder({
      orgId: req.thea!.org.id,
      planKey: plan.key,
      interval: billingInterval,
      amount: amountForPlan(plan.key, billingInterval),
    });
    res.json({ orderId });
  } catch (err) {
    logger.error({ err }, "PayPal order creation failed");
    res.status(502).json({ error: "Could not start PayPal checkout" });
  }
});

/** PayPal — capture an approved order; the capture response is the grant path. */
router.post("/paypal/capture", requireRole("owner", "admin"), async (req, res) => {
  const { orderId } = req.body as { orderId?: string };
  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }
  if (!(await isPaypalConfigured())) {
    res.status(503).json({ error: "PayPal is not configured yet" });
    return;
  }
  try {
    const cap = await capturePaypalOrder(orderId);
    if (cap.status !== "COMPLETED") {
      res.status(402).json({ error: "Payment was not completed" });
      return;
    }
    if (!cap.customId) {
      res.status(400).json({ error: "Order is missing required metadata" });
      return;
    }
    let parsed: { orgId?: string; planKey?: string; interval?: string };
    try {
      parsed = JSON.parse(cap.customId);
    } catch {
      res.status(400).json({ error: "Order metadata is invalid" });
      return;
    }
    const callerOrg = req.thea!.org.id;
    if (parsed.orgId !== callerOrg) {
      res.status(403).json({ error: "This order does not belong to your account" });
      return;
    }
    if (!parsed.planKey || !isPlanKey(parsed.planKey)) {
      res.status(400).json({ error: "Unknown plan" });
      return;
    }
    const billingInterval: BillingInterval = parsed.interval === "annual" ? "annual" : "monthly";
    const expected = amountForPlan(parsed.planKey, billingInterval).toFixed(2);
    if (cap.currency !== "USD" || cap.amountValue !== expected) {
      logger.error({ orderId, captured: cap.amountValue, expected }, "PayPal captured amount mismatch");
      res.status(400).json({ error: "Payment amount did not match the plan price" });
      return;
    }
    const tier = PLAN_TO_TIER[parsed.planKey];
    await activateSubscription({
      orgId: callerOrg,
      tier,
      provider: "paypal",
      providerRef: cap.captureId,
      planKey: parsed.planKey,
      interval: billingInterval,
      amount: cap.amountValue,
      currency: cap.currency,
      periodEnd: periodEndFor(billingInterval),
    });
    res.json({ success: true, tier });
  } catch (err) {
    logger.error({ err }, "PayPal capture failed");
    res.status(502).json({ error: "Could not complete the PayPal payment" });
  }
});

/** Crypto — issue a USDT payment intent with a unique dust-suffixed amount. */
router.post("/crypto/intent", requireRole("owner", "admin"), async (req, res) => {
  const { planKey, interval } = req.body as { planKey?: string; interval?: string };
  const plan = planKey ? planFromKey(planKey) : null;
  if (!plan) {
    res.status(400).json({ error: "Unknown plan" });
    return;
  }
  const cfg = await getCryptoConfig();
  if (!cfg) {
    res.status(503).json({ error: "Crypto payments are not configured yet" });
    return;
  }
  const billingInterval: BillingInterval = interval === "annual" ? "annual" : "monthly";
  const baseAmount = amountForPlan(plan.key, billingInterval); // whole USD
  const factor = 10n ** BigInt(cfg.decimals);
  // Dust suffix (< ~1 USDT) makes each intent's expected amount unique so a
  // given on-chain transfer can only satisfy the intent it was created for.
  const dust = BigInt(randomInt(1, 1_000_000));
  const baseUnits = BigInt(baseAmount) * factor + dust;
  const amountDisplay = formatUsdt(baseUnits, cfg.decimals);
  const expiresAt = new Date(Date.now() + cfg.intentTtlMinutes * 60 * 1000);

  const [intent] = await db
    .insert(cryptoPaymentIntentsTable)
    .values({
      orgId: req.thea!.org.id,
      planKey: plan.key,
      tier: plan.tier,
      interval: billingInterval,
      chain: cfg.chain,
      tokenAddress: cfg.tokenAddress,
      receivingAddress: cfg.receivingAddress,
      amountDisplay,
      amountBaseUnits: baseUnits.toString(),
      currency: "USDT",
      status: "pending",
      expiresAt,
    })
    .returning();

  res.json({
    data: {
      intentId: intent.id,
      chain: cfg.chain,
      token: "USDT",
      tokenAddress: cfg.tokenAddress,
      receivingAddress: cfg.receivingAddress,
      amount: amountDisplay,
      decimals: cfg.decimals,
      minConfirmations: cfg.minConfirmations,
      expiresAt: expiresAt.toISOString(),
    },
  });
});

/** Crypto — verify a submitted transaction hash against a pending intent. */
router.post("/crypto/verify", requireRole("owner", "admin"), async (req, res) => {
  const { intentId, txHash } = req.body as { intentId?: string; txHash?: string };
  if (!intentId || !txHash) {
    res.status(400).json({ error: "intentId and txHash are required" });
    return;
  }
  const normalized = txHash.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
    res.status(400).json({ error: "That does not look like a valid transaction hash" });
    return;
  }
  const cfg = await getCryptoConfig();
  if (!cfg) {
    res.status(503).json({ error: "Crypto payments are not configured yet" });
    return;
  }

  const [intent] = await db
    .select()
    .from(cryptoPaymentIntentsTable)
    .where(
      and(
        eq(cryptoPaymentIntentsTable.id, intentId),
        eq(cryptoPaymentIntentsTable.orgId, req.thea!.org.id),
      ),
    )
    .limit(1);
  if (!intent) {
    res.status(404).json({ error: "Payment request not found" });
    return;
  }
  if (intent.status === "confirmed") {
    res.json({ success: true, tier: intent.tier });
    return;
  }
  if (new Date() > intent.expiresAt) {
    await db
      .update(cryptoPaymentIntentsTable)
      .set({ status: "expired" })
      .where(eq(cryptoPaymentIntentsTable.id, intent.id));
    res.status(410).json({ error: "This payment request expired — please start a new one" });
    return;
  }

  // A given transaction can back at most one intent.
  const [used] = await db
    .select({ id: cryptoPaymentIntentsTable.id })
    .from(cryptoPaymentIntentsTable)
    .where(eq(cryptoPaymentIntentsTable.txHash, normalized))
    .limit(1);
  if (used) {
    res.status(409).json({ error: "This transaction has already been used" });
    return;
  }

  const result = await verifyUsdtPayment(cfg, {
    txHash: normalized,
    expectedBaseUnits: BigInt(intent.amountBaseUnits),
    createdAt: intent.createdAt,
  });
  if (!result.ok) {
    res.status(202).json({ pending: true, reason: result.reason });
    return;
  }

  await activateSubscription({
    orgId: intent.orgId,
    tier: intent.tier as Tier,
    provider: "crypto",
    providerRef: normalized,
    planKey: intent.planKey,
    interval: intent.interval as BillingInterval,
    amount: intent.amountDisplay,
    currency: "USDT",
    periodEnd: periodEndFor(intent.interval as BillingInterval),
    metadata: { chain: cfg.chain, txHash: normalized },
  });
  await db
    .update(cryptoPaymentIntentsTable)
    .set({ status: "confirmed", txHash: normalized, confirmedAt: new Date() })
    .where(eq(cryptoPaymentIntentsTable.id, intent.id));

  res.json({ success: true, tier: intent.tier });
});

export default router;
