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
    description: "Up to 5 users, 10 watchlist keywords, 3 categories, 14-day history",
    monthlyUsd: 99,
    // Annual = discounted per-month price ($79) x 12. MUST equal amountForPlan()
    // in lib/plans.ts so PayPal/crypto annual charges match the Stripe price.
    annualUsd: 948,
    metadata: {
      tier: "starter",
      maxUsers: "5",
      maxKeywords: "10",
      maxCategories: "3",
      historyDays: "14",
    },
  },
  {
    name: "THEA Pro",
    description: "Up to 20 users, 50 watchlist keywords, 7 categories, 90-day history",
    monthlyUsd: 499,
    // Annual = discounted per-month price ($399) x 12.
    annualUsd: 4788,
    metadata: {
      tier: "pro",
      maxUsers: "20",
      maxKeywords: "50",
      maxCategories: "7",
      historyDays: "90",
    },
  },
  {
    name: "THEA Enterprise",
    description: "Unlimited users, keywords, and categories — 10-year history, dedicated support",
    monthlyUsd: 1999,
    // Annual = discounted per-month price ($1,599) x 12.
    annualUsd: 19188,
    metadata: {
      tier: "enterprise",
      maxUsers: "-1",
      maxKeywords: "-1",
      maxCategories: "-1",
      historyDays: "3650",
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
  console.log("  STRIPE_STARTER_MONTHLY_PRICE_ID  ($99/mo)");
  console.log("  STRIPE_STARTER_ANNUAL_PRICE_ID   ($948/yr)");
  console.log("  STRIPE_PRO_MONTHLY_PRICE_ID      ($499/mo)");
  console.log("  STRIPE_PRO_ANNUAL_PRICE_ID       ($4,788/yr)");
  console.log("  STRIPE_ENTERPRISE_MONTHLY_PRICE_ID ($1,999/mo)");
  console.log("  STRIPE_ENTERPRISE_ANNUAL_PRICE_ID  ($19,188/yr)");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
