import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { TIER_FEATURES, type Tier } from "./featureGate";
import { logger } from "../lib/logger";
import type { Organization, User, Subscription } from "@workspace/db/schema";

export interface TheaRequestContext {
  user: User;
  org: Organization;
  subscription: Subscription;
  tier: Tier;
  featureFlags: string[];
}

declare global {
  namespace Express {
    interface Request {
      thea?: TheaRequestContext;
    }
  }
}

const TIER_LIMITS: Record<Tier, { maxKeywords: number; maxCategories: number; historyDays: number }> = {
  starter: { maxKeywords: 10, maxCategories: 3, historyDays: 14 },
  pro: { maxKeywords: 50, maxCategories: 7, historyDays: 90 },
  enterprise: { maxKeywords: 9999, maxCategories: 99, historyDays: 3650 },
};

function slugify(str: string): string {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

async function jitProvision(
  clerkUserId: string,
  email: string,
  name?: string | null
): Promise<{ user: User; org: Organization; subscription: Subscription }> {
  const orgName = name || email.split("@")[0] || "My Organization";
  const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

  const [org] = await db
    .insert(organizationsTable)
    .values({ name: orgName, slug, focus: "general" })
    .returning();

  const [user] = await db
    .insert(usersTable)
    .values({ orgId: org.id, clerkUserId, email, name: name ?? null, role: "owner" })
    .returning();

  const [subscription] = await db
    .insert(subscriptionsTable)
    .values({ orgId: org.id, tier: "starter", status: "active", ...TIER_LIMITS.starter })
    .returning();

  logger.info({ orgId: org.id, clerkUserId }, "JIT provisioned org + user + subscription");
  return { user, org, subscription };
}

export async function resolveOrgContext(
  clerkUserId: string,
  email: string,
  name?: string | null
): Promise<TheaRequestContext | null> {
  const userRows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);

  let user: User;
  let org: Organization;
  let subscription: Subscription;

  if (userRows.length === 0) {
    const p = await jitProvision(clerkUserId, email, name);
    user = p.user;
    org = p.org;
    subscription = p.subscription;
  } else {
    user = userRows[0];

    const orgRows = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.orgId)).limit(1);
    if (!orgRows[0]) return null;
    org = orgRows[0];

    const subRows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, org.id)).limit(1);
    if (!subRows[0]) return null;
    subscription = subRows[0];
  }

  const tier = (subscription.tier as Tier) || "starter";
  return { user, org, subscription, tier, featureFlags: TIER_FEATURES[tier] ?? TIER_FEATURES.starter };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const clerkUserId = auth.userId;
  const email = (auth.sessionClaims?.email as string) || "";
  const name = (auth.sessionClaims?.name as string) || null;

  resolveOrgContext(clerkUserId, email, name)
    .then((context) => {
      if (!context) {
        res.status(403).json({ error: "Organization not found" });
        return;
      }
      req.thea = context;
      next();
    })
    .catch((err) => {
      logger.error({ err }, "requireAuth: unhandled error resolving org context");
      next(err);
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.thea?.user.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: `Requires one of roles: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}
