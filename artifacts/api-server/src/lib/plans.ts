import type { Tier } from "../middlewares/featureGate";

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
 * Resolve the Stripe Price ID for a package + interval from environment config.
 * Tier -> env var mapping is kept server-side so the client can never smuggle in
 * an arbitrary priceId to buy a plan it did not pay for.
 */
export function priceIdForPlan(key: PlanKey, interval: BillingInterval): string {
  const tier = PLAN_TO_TIER[key];
  const envByTier: Record<Tier, Record<BillingInterval, string>> = {
    starter: { monthly: "STRIPE_STARTER_MONTHLY_PRICE_ID", annual: "STRIPE_STARTER_ANNUAL_PRICE_ID" },
    pro: { monthly: "STRIPE_PRO_MONTHLY_PRICE_ID", annual: "STRIPE_PRO_ANNUAL_PRICE_ID" },
    enterprise: { monthly: "STRIPE_ENTERPRISE_MONTHLY_PRICE_ID", annual: "STRIPE_ENTERPRISE_ANNUAL_PRICE_ID" },
  };
  const envKey = envByTier[tier][interval];
  return process.env[envKey] || "";
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
