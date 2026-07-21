import { db } from "@workspace/db";
import { subscriptionPlansTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import { TIER_LIMITS, type Tier } from "../middlewares/featureGate";
import { getPlatformConfig } from "./platform-config";
import { logger } from "./logger";

/**
 * PR subscription packages. These are the audience-facing product packages the
 * marketing site sells; each maps onto exactly one internal feature/limit tier
 * so all existing gating (requireTier / requireFeature / TIER_LIMITS) is reused.
 *
 *   professional -> starter    (~$99/mo)   Professionals & consultants
 *   business     -> pro        (~$499/mo)  Brands & enterprises
 *   political    -> enterprise (~$1,999/mo) Political parties & campaigns
 */
export type PlanKey = "professional" | "business" | "political";
export type BillingInterval = "monthly" | "annual";

export const PLAN_TO_TIER: Record<PlanKey, Tier> = {
  professional: "starter",
  business: "pro",
  political: "enterprise",
};

export interface PlanDef {
  key: PlanKey;
  tier: Tier;
  name: string;
  segment: string;
  /** Sticker price billed monthly (USD). */
  priceMonthly: number;
  /** Effective per-month price when billed annually (USD). */
  priceAnnual: number;
}

export const PLANS: Record<PlanKey, PlanDef> = {
  professional: {
    key: "professional",
    tier: "starter",
    name: "Professional",
    segment: "Professionals & Consultants",
    priceMonthly: 99,
    priceAnnual: 79,
  },
  business: {
    key: "business",
    tier: "pro",
    name: "Business",
    segment: "Brands & Enterprises",
    priceMonthly: 499,
    priceAnnual: 399,
  },
  political: {
    key: "political",
    tier: "enterprise",
    name: "Political Party",
    segment: "Parties & Campaigns",
    priceMonthly: 1999,
    priceAnnual: 1599,
  },
};

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "professional" || value === "business" || value === "political";
}

export function planFromKey(key: string): PlanDef | null {
  return isPlanKey(key) ? PLANS[key] : null;
}

/**
 * Resolve the Stripe Price ID for a package + interval. Reads the DB-backed
 * platform config (Super Admin › API Keys), falling back to the matching env
 * var. The tier -> key mapping is kept server-side so the client can never
 * smuggle in an arbitrary priceId to buy a plan it did not pay for.
 */
export async function priceIdForPlan(key: PlanKey, interval: BillingInterval): Promise<string> {
  const tier = PLAN_TO_TIER[key];
  const keyByTier: Record<Tier, Record<BillingInterval, string>> = {
    starter: { monthly: "stripe_starter_monthly_price_id", annual: "stripe_starter_annual_price_id" },
    pro: { monthly: "stripe_pro_monthly_price_id", annual: "stripe_pro_annual_price_id" },
    enterprise: { monthly: "stripe_enterprise_monthly_price_id", annual: "stripe_enterprise_annual_price_id" },
  };
  return (await getPlatformConfig(keyByTier[tier][interval])) ?? "";
}

/**
 * Total USD amount charged for one billing cycle (used for PayPal & crypto,
 * which take a single up-front payment rather than a Stripe recurring price).
 * Annual = discounted per-month price x 12.
 */
export function amountForPlan(key: PlanKey, interval: BillingInterval): number {
  const plan = PLANS[key];
  return interval === "annual" ? plan.priceAnnual * 12 : plan.priceMonthly;
}

/** Factual, tier-derived marketing bullets used to seed a new plan's display list. */
function featuresForTier(tier: Tier): string[] {
  const l = TIER_LIMITS[tier];
  const base = [
    l.maxKeywords >= 9999 ? "Unlimited tracked keywords" : `Up to ${l.maxKeywords} tracked keywords`,
    l.maxCategories >= 99 ? "Unlimited categories" : `${l.maxCategories} categories`,
    `${l.historyDays} days of history`,
  ];
  // Display-only bullets for newer platform services, layered by tier.
  const extras: Record<Tier, string[]> = {
    starter: ["Scheduled intelligence digest emails"],
    pro: [
      "Scheduled intelligence digest emails",
      "Expanded social coverage: TikTok, Telegram, YouTube & more",
    ],
    enterprise: [
      "Scheduled intelligence digest emails",
      "Expanded social coverage: TikTok, Telegram, YouTube & more",
      "What-if response simulations",
      "THEA Access — biometric access control for events & HQs",
    ],
  };
  return [...base, ...extras[tier]];
}

/**
 * One-time backfill of the operator-managed plan catalogue from the hard-coded
 * PLANS baseline. Seeds ONLY when the table is empty so it never clobbers
 * operator edits or resurrects a plan the operator has deleted.
 */
export async function seedSubscriptionPlans(): Promise<void> {
  const [row] = await db.select({ c: count() }).from(subscriptionPlansTable);
  if (Number(row?.c ?? 0) > 0) return;

  const order: PlanKey[] = ["professional", "business", "political"];
  await db.insert(subscriptionPlansTable).values(
    order.map((key, i) => {
      const p = PLANS[key];
      return {
        key: p.key,
        name: p.name,
        description: p.segment,
        tier: p.tier,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        features: featuresForTier(p.tier),
        active: true,
        sortOrder: i,
      };
    }),
  );
  logger.info({ count: order.length }, "Seeded subscription plans catalogue");
}
