/**
 * stripeProvisioning.ts
 *
 * Idempotently provisions the Stripe objects THEA billing needs:
 *   1. Three products (Starter / Pro / Enterprise) with tier metadata.
 *   2. Six recurring prices (monthly + annual) whose amounts match
 *      amountForPlan() in lib/plans.ts so PayPal/crypto annual charges stay in
 *      lockstep with Stripe.
 *   3. A webhook endpoint pointing at <apiOrigin>/api/webhooks/stripe that
 *      listens for the subscription/invoice events our handler processes.
 *
 * Must run inside the API server process, which is where the real
 * STRIPE_SECRET_KEY is available. Returns the resulting price-ID env map plus
 * the webhook signing secret so the caller can persist them.
 */

import { writeFileSync } from "node:fs";
import type Stripe from "stripe";
import { getStripeClient } from "./stripe";
import { logger } from "./logger";

interface TierConfig {
  tier: "starter" | "pro" | "enterprise";
  envPrefix: string;
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number;
  metadata: Record<string, string>;
}

const TIERS: TierConfig[] = [
  {
    tier: "starter",
    envPrefix: "STRIPE_STARTER",
    name: "THEA Starter",
    description: "Up to 5 users, 10 watchlist keywords, 3 categories, 14-day history",
    monthlyUsd: 99,
    annualUsd: 948,
    metadata: { tier: "starter", maxUsers: "5", maxKeywords: "10", maxCategories: "3", historyDays: "14" },
  },
  {
    tier: "pro",
    envPrefix: "STRIPE_PRO",
    name: "THEA Pro",
    description: "Up to 20 users, 50 watchlist keywords, 7 categories, 90-day history",
    monthlyUsd: 499,
    annualUsd: 4788,
    metadata: { tier: "pro", maxUsers: "20", maxKeywords: "50", maxCategories: "7", historyDays: "90" },
  },
  {
    tier: "enterprise",
    envPrefix: "STRIPE_ENTERPRISE",
    name: "THEA Enterprise",
    description: "Unlimited users, keywords, and categories — 10-year history, dedicated support",
    monthlyUsd: 1999,
    annualUsd: 19188,
    metadata: { tier: "enterprise", maxUsers: "-1", maxKeywords: "-1", maxCategories: "-1", historyDays: "3650" },
  },
];

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

export interface StripeProvisionResult {
  priceEnv: Record<string, string>;
  webhookSecret: string;
  webhookUrl: string;
  webhookId: string;
}

async function findProductByTier(stripe: Stripe, tier: string): Promise<Stripe.Product | undefined> {
  let startingAfter: string | undefined;
  for (;;) {
    const page: Stripe.ApiList<Stripe.Product> = await stripe.products.list({
      limit: 100,
      active: true,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find((p) => p.metadata?.tier === tier);
    if (match) return match;
    if (!page.has_more || page.data.length === 0) return undefined;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  interval: "month" | "year",
  amountUsd: number,
  nickname: string,
  billing: string,
  tier: string,
): Promise<string> {
  const prices = await stripe.prices.list({ product: productId, limit: 100, active: true });
  const existing = prices.data.find(
    (pr) =>
      pr.recurring?.interval === interval &&
      pr.unit_amount === amountUsd * 100 &&
      pr.currency === "usd",
  );
  if (existing) return existing.id;
  const created = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountUsd * 100,
    recurring: { interval },
    nickname,
    metadata: { tier, billing },
  });
  return created.id;
}

export async function runStripeProvisioning(opts: {
  apiOrigin: string;
  outPath?: string;
}): Promise<StripeProvisionResult> {
  const origin = opts.apiOrigin.replace(/\/$/, "");
  if (!origin) throw new Error("apiOrigin is required to build the webhook URL");
  const webhookUrl = `${origin}/api/webhooks/stripe`;

  const stripe = await getStripeClient();

  const priceEnv: Record<string, string> = {};

  for (const t of TIERS) {
    let product = await findProductByTier(stripe, t.tier);
    if (!product) {
      product = await stripe.products.create({
        name: t.name,
        description: t.description,
        metadata: t.metadata,
      });
      logger.info({ product: product.id, tier: t.tier }, "Created Stripe product");
    }

    priceEnv[`${t.envPrefix}_MONTHLY_PRICE_ID`] = await ensurePrice(
      stripe,
      product.id,
      "month",
      t.monthlyUsd,
      `${t.name} — Monthly`,
      "monthly",
      t.tier,
    );
    priceEnv[`${t.envPrefix}_ANNUAL_PRICE_ID`] = await ensurePrice(
      stripe,
      product.id,
      "year",
      t.annualUsd,
      `${t.name} — Annual`,
      "annual",
      t.tier,
    );
  }

  // Webhook: remove any existing endpoint for this exact URL, then create fresh
  // so we can capture the signing secret (Stripe only returns it on creation).
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  for (const ep of endpoints.data) {
    if (ep.url === webhookUrl) {
      await stripe.webhookEndpoints.del(ep.id);
      logger.info({ endpoint: ep.id }, "Removed existing Stripe webhook endpoint");
    }
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: "THEA billing subscription lifecycle",
  });
  logger.info({ endpoint: endpoint.id }, "Created Stripe webhook endpoint");

  const result: StripeProvisionResult = {
    priceEnv,
    webhookSecret: endpoint.secret ?? "",
    webhookUrl,
    webhookId: endpoint.id,
  };

  if (opts.outPath) {
    writeFileSync(opts.outPath, JSON.stringify(result, null, 2), { mode: 0o600 });
  }

  return result;
}
