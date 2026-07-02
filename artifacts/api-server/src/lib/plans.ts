import type { Tier } from "../middlewares/featureGate";
import { getPlatformConfig } from "./platform-config";

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
