/**
 * seed-stripe-products.ts
 * Run once to create THEA Stripe products and prices, then paste the
 * resulting price IDs into your environment variables:
 *
 *   STRIPE_STARTER_MONTHLY_PRICE_ID
 *   STRIPE_STARTER_ANNUAL_PRICE_ID
 *   STRIPE_PRO_MONTHLY_PRICE_ID
 *   STRIPE_PRO_ANNUAL_PRICE_ID
 *   STRIPE_ENTERPRISE_MONTHLY_PRICE_ID
 *   STRIPE_ENTERPRISE_ANNUAL_PRICE_ID
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm --filter @workspace/api-server exec \
 *     tsx src/scripts/seed-stripe-products.ts
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" });

interface TierConfig {
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number;
  metadata: Record<string, string>;
}

const TIERS: TierConfig[] = [
  {
    name: "THEA Starter",
    description: "Up to 5 users, 3 watchlist keywords, 1 market, standard analytics",
    monthlyUsd: 49,
    annualUsd: 470,
    metadata: {
      tier: "starter",
      maxUsers: "5",
      maxKeywords: "3",
      maxMarkets: "1",
    },
  },
  {
    name: "THEA Pro",
    description: "Up to 20 users, 20 watchlist keywords, 10 markets, advanced analytics",
    monthlyUsd: 199,
    annualUsd: 1910,
    metadata: {
      tier: "pro",
      maxUsers: "20",
      maxKeywords: "20",
      maxMarkets: "10",
    },
  },
  {
    name: "THEA Enterprise",
    description: "Unlimited users, keywords, and markets — custom SLA and dedicated support",
    monthlyUsd: 999,
    annualUsd: 9590,
    metadata: {
      tier: "enterprise",
      maxUsers: "-1",
      maxKeywords: "-1",
      maxMarkets: "-1",
    },
  },
];

async function seed(): Promise<void> {
  console.log("Creating THEA Stripe products and prices...\n");

  for (const tier of TIERS) {
    console.log(`Creating product: ${tier.name}`);
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
      metadata: tier.metadata,
    });
    console.log(`  Product ID: ${product.id}`);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: tier.monthlyUsd * 100,
      recurring: { interval: "month" },
      nickname: `${tier.name} — Monthly`,
      metadata: { tier: tier.metadata.tier, billing: "monthly" },
    });
    console.log(`  Monthly price ID: ${monthlyPrice.id}`);

    const annualPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: tier.annualUsd * 100,
      recurring: { interval: "year" },
      nickname: `${tier.name} — Annual`,
      metadata: { tier: tier.metadata.tier, billing: "annual" },
    });
    console.log(`  Annual price ID:  ${annualPrice.id}\n`);
  }

  console.log("Done! Copy the price IDs above into your environment variables:");
  console.log("  STRIPE_STARTER_MONTHLY_PRICE_ID");
  console.log("  STRIPE_STARTER_ANNUAL_PRICE_ID");
  console.log("  STRIPE_PRO_MONTHLY_PRICE_ID");
  console.log("  STRIPE_PRO_ANNUAL_PRICE_ID");
  console.log("  STRIPE_ENTERPRISE_MONTHLY_PRICE_ID");
  console.log("  STRIPE_ENTERPRISE_ANNUAL_PRICE_ID");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
