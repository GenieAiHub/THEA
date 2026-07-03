import { Router } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable,
  subscriptionsTable,
  collectionRunsTable,
  llmUsageLogsTable,
  usersTable,
} from "@workspace/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { TIER_LIMITS } from "../../middlewares/featureGate";
import { requireOperator } from "../../middlewares/operator";
import { PLATFORM_ORG_ID } from "../../lib/tenantScope";

const router = Router();

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

  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
  // Operator grants are manual and carry no billing period, so clear any lapsed
  // currentPeriodEnd (e.g. from an expired PayPal/crypto plan) and reactivate.
  // Otherwise resolveOrgContext's expiry check would silently downgrade the org
  // back to starter on the very next request, negating the grant.
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ tier, ...limits, status: "active", currentPeriodEnd: null, updatedAt: new Date() })
    .where(eq(subscriptionsTable.orgId, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Subscription not found for this org" }); return; }

  res.json({ data: { orgId: req.params.id, tier: updated.tier, ...limits } });
});

router.patch("/orgs/:id/pause", async (req, res) => {
  const { paused } = req.body as { paused: boolean };
  // Suspension revokes all requireAuth access for the org's members. Refuse to
  // suspend the platform org itself, which would lock operators out of the
  // authenticated product surface.
  if (paused && req.params.id === PLATFORM_ORG_ID) {
    res.status(400).json({ error: "The platform organization cannot be suspended" });
    return;
  }
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
