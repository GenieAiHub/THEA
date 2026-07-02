import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "./errorHandler";

export type Tier = "starter" | "pro" | "enterprise";

export const TIER_ORDER: Record<Tier, number> = {
  starter: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Resource limits per tier. Single source of truth — imported by the auth
 * middleware (registration), the subscription-activation service, and the
 * Stripe/PayPal/crypto payment paths so a tier always grants identical limits
 * regardless of how it was purchased.
 */
export const TIER_LIMITS: Record<Tier, { maxKeywords: number; maxCategories: number; historyDays: number }> = {
  starter: { maxKeywords: 10, maxCategories: 3, historyDays: 14 },
  pro: { maxKeywords: 50, maxCategories: 7, historyDays: 90 },
  enterprise: { maxKeywords: 9999, maxCategories: 99, historyDays: 3650 },
};

export const TIER_FEATURES: Record<Tier, string[]> = {
  starter: ["basic_dashboard", "watchlist", "email_digest"],
  pro: [
    "basic_dashboard", "watchlist", "email_digest",
    "pdf_export", "pptx_export", "geo_map",
    "influencer_scoring", "what_if_simulator", "campaign_tracker",
    "competitor_intel", "crisis_alerts",
  ],
  enterprise: [
    "basic_dashboard", "watchlist", "email_digest",
    "pdf_export", "pptx_export", "geo_map",
    "influencer_scoring", "what_if_simulator", "campaign_tracker",
    "competitor_intel", "crisis_alerts",
    "developer_api", "webhooks", "white_label",
    "crm_integration", "slack_bot", "teams_bot",
  ],
};

export function requireTier(minTier: Tier) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const orgTier: Tier = req.thea?.tier ?? "starter";
    if (TIER_ORDER[orgTier] < TIER_ORDER[minTier]) {
      throw new AppError(402, `This feature requires a ${minTier} subscription or higher`, "TIER_REQUIRED");
    }
    next();
  };
}

export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const flags = req.thea?.featureFlags ?? TIER_FEATURES.starter;
    if (!flags.includes(feature)) {
      throw new AppError(402, "This feature is not available on your current plan — upgrade to unlock it", "FEATURE_REQUIRED");
    }
    next();
  };
}
