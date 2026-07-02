import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable,
  subscriptionsTable,
  collectionRunsTable,
  llmUsageLogsTable,
  usersTable,
} from "@workspace/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { resolveOrgContext, getUserByToken } from "../../middlewares/auth";
import { readSessionCookie } from "../../lib/auth";
import { PLATFORM_ORG_ID } from "../../lib/tenantScope";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

/**
 * Dual-path operator authentication:
 *   Path 1 — server-to-server: `x-admin-token` or `Authorization: Bearer <ADMIN_INTERNAL_TOKEN>`
 *   Path 2 — session cookie: valid session where the user belongs to the platform org with
 *             role "owner" or "admin". This is the preferred human-facing auth path.
 */
async function requireOperator(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Path 1: static internal token (server-to-server / CI / scripts)
  const provided =
    (req.headers["x-admin-token"] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (ADMIN_TOKEN && provided === ADMIN_TOKEN) {
    next();
    return;
  }

  // Path 2: session cookie — must belong to PLATFORM org with owner or admin role
  const token = readSessionCookie(req);
  if (token) {
    try {
      const user = await getUserByToken(token);
      if (user) {
        const context = await resolveOrgContext(user);
        if (
          context &&
          context.org.id === PLATFORM_ORG_ID &&
          ["owner", "admin"].includes(context.user.role)
        ) {
          req.thea = context;
          next();
          return;
        }
        res.status(403).json({ error: "Operator role required (platform org owner or admin)" });
        return;
      }
    } catch {
      res.status(500).json({ error: "Failed to verify operator identity" });
      return;
    }
  }

  res.status(401).json({ error: "Invalid or missing admin token or session" });
}

router.use(requireOperator);

router.get("/orgs", async (_req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  const subs = await db.select().from(subscriptionsTable);
  const members = await db.select({ orgId: usersTable.orgId, cnt: count() }).from(usersTable).groupBy(usersTable.orgId);

  const subMap = new Map(subs.map((s) => [s.orgId, s]));
  const memberMap = new Map(members.map((m) => [m.orgId, Number(m.cnt)]));

  res.json({
    data: orgs.map((org) => {
      const sub = subMap.get(org.id);
      return {
        ...org,
        tier: sub?.tier ?? "starter",
        subscriptionStatus: sub?.status ?? "none",
        stripeCustomerId: sub?.stripeCustomerId ?? null,
        memberCount: memberMap.get(org.id) ?? 0,
        isPaused: !!org.pausedAt,
        onboardingCompleted: !!org.onboardingCompletedAt,
      };
    }),
  });
});

router.get("/orgs/:id", async (req, res) => {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.params.id)).limit(1);
  if (!org) { res.status(404).json({ error: "Org not found" }); return; }

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, org.id)).limit(1);
  const members = await db.select().from(usersTable).where(eq(usersTable.orgId, org.id));

  res.json({ data: { ...org, subscription: sub ?? null, members } });
});

router.patch("/orgs/:id/tier", async (req, res) => {
  const { tier } = req.body as { tier: string };
  const VALID_TIERS = ["starter", "pro", "enterprise"];
  if (!VALID_TIERS.includes(tier)) {
    res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` });
    return;
  }

  const TIER_LIMITS: Record<string, { maxKeywords: number; maxCategories: number; historyDays: number }> = {
    starter: { maxKeywords: 10, maxCategories: 3, historyDays: 14 },
    pro: { maxKeywords: 50, maxCategories: 7, historyDays: 90 },
    enterprise: { maxKeywords: 9999, maxCategories: 99, historyDays: 3650 },
  };

  const limits = TIER_LIMITS[tier];
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ tier, ...limits, updatedAt: new Date() })
    .where(eq(subscriptionsTable.orgId, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Subscription not found for this org" }); return; }

  res.json({ data: { orgId: req.params.id, tier: updated.tier, ...limits } });
});

router.patch("/orgs/:id/pause", async (req, res) => {
  const { paused } = req.body as { paused: boolean };
  const [updated] = await db
    .update(organizationsTable)
    .set({ pausedAt: paused ? new Date() : null, updatedAt: new Date() })
    .where(eq(organizationsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Org not found" }); return; }

  res.json({ data: { orgId: req.params.id, isPaused: !!updated.pausedAt } });
});

router.get("/subscriptions", async (_req, res) => {
  const subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt));
  res.json({ data: subs });
});

router.get("/llm-usage", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const recent = await db
    .select()
    .from(llmUsageLogsTable)
    .orderBy(desc(llmUsageLogsTable.createdAt))
    .limit(limit);
  res.json({ data: recent });
});

router.get("/collection-runs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const runs = await db
    .select()
    .from(collectionRunsTable)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(limit);
  res.json({ data: runs });
});

router.get("/stats", async (_req, res) => {
  const [orgCount] = await db.select({ count: count() }).from(organizationsTable);
  const [userCount] = await db.select({ count: count() }).from(usersTable);

  const tierCounts = await db
    .select({ tier: subscriptionsTable.tier, count: count() })
    .from(subscriptionsTable)
    .groupBy(subscriptionsTable.tier);

  res.json({
    organizations: orgCount?.count ?? 0,
    users: userCount?.count ?? 0,
    tierBreakdown: Object.fromEntries(tierCounts.map((t) => [t.tier, Number(t.count)])),
    timestamp: new Date().toISOString(),
  });
});

export default router;
