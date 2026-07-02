import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireFeature } from "../../middlewares/featureGate";
import { createCheckoutSession, createBillingPortalSession, getStripeClient } from "../../lib/stripe";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

router.use(requireAuth);

const TIER_PRICES = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || "",
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || "",
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
  },
  enterprise: {
    monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || "",
    annual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID || "",
  },
} as const;

const TIER_DISPLAY = {
  starter: { name: "Starter", priceMonthly: 99, priceAnnual: 79 },
  pro: { name: "Pro", priceMonthly: 499, priceAnnual: 399 },
  enterprise: { name: "Enterprise", priceMonthly: 1999, priceAnnual: 1599 },
};

/** All billing reads: any authenticated user (analysts see plan info) */
router.get("/plan", async (req, res) => {
  const { subscription, tier } = req.thea!;
  const display = TIER_DISPLAY[tier] ?? TIER_DISPLAY.starter;

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
        prices: TIER_PRICES[t as keyof typeof TIER_PRICES],
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
    const stripe = getStripeClient();
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
  const { priceId, successUrl, cancelUrl } = req.body as {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  };

  if (!priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "priceId, successUrl, and cancelUrl are required" });
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

export default router;
