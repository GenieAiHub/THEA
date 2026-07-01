import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "./errorHandler";

export type Tier = "starter" | "pro" | "enterprise";

const TIER_ORDER: Record<Tier, number> = {
  starter: 0,
  pro: 1,
  enterprise: 2,
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
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // Stub: org tier will be populated by auth middleware in Phase 4
    // For now, default to enterprise (no gating during development)
    const orgTier: Tier = "enterprise";
    if (TIER_ORDER[orgTier] < TIER_ORDER[minTier]) {
      throw new AppError(402, `This feature requires a ${minTier} subscription or higher`, "TIER_REQUIRED");
    }
    next();
  };
}

export function requireFeature(feature: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // Stub: will use org tier from auth middleware in Phase 4
    next();
    void feature;
  };
}
