import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  organizationsTable,
  subscriptionsTable,
  subscriptionPlansTable,
  insertSubscriptionPlanSchema,
  collectionRunsTable,
  llmUsageLogsTable,
  usersTable,
} from "@workspace/db/schema";
import { desc, asc, count, eq } from "drizzle-orm";
import { TIER_LIMITS, type Tier } from "../../middlewares/featureGate";
import { activateSubscription } from "../../lib/subscriptionService";
import { requireOperator } from "../../middlewares/operator";
import { PLATFORM_ORG_ID } from "../../lib/tenantScope";

const router = Router();

router.use(requireOperator);

/** True if `e` is a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

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

// ─── Subscription plan catalogue (CRUD) ───────────────────────────────────────
// NOTE: this is the catalogue source of truth (what plans exist, their display
// prices, and the tier each grants). It does NOT change what real customers are
// charged at checkout — Stripe/PayPal/crypto amounts stay wired to lib/plans.ts.

router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(subscriptionPlansTable)
    .orderBy(asc(subscriptionPlansTable.sortOrder), asc(subscriptionPlansTable.priceMonthly));
  res.json({ data: plans });
});

router.post("/plans", async (req, res) => {
  const parsed = insertSubscriptionPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" });
    return;
  }
  try {
    const [created] = await db.insert(subscriptionPlansTable).values(parsed.data).returning();
    res.status(201).json({ data: created });
  } catch (e) {
    if (isUniqueViolation(e)) {
      res.status(409).json({ error: `A plan with key "${parsed.data.key}" already exists` });
      return;
    }
    throw e;
  }
});

router.patch("/plans/:id", async (req, res) => {
  const parsed = insertSubscriptionPlanSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" });
    return;
  }
  try {
    const [updated] = await db
      .update(subscriptionPlansTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(subscriptionPlansTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Plan not found" }); return; }
    res.json({ data: updated });
  } catch (e) {
    if (isUniqueViolation(e)) {
      res.status(409).json({ error: "A plan with that key already exists" });
      return;
    }
    throw e;
  }
});

router.delete("/plans/:id", async (req, res) => {
  // Safe to hard-delete: subscriptions store the granted `tier` (denormalized),
  // never a plan id, so removing a plan cannot strand an org's active grant.
  const [deleted] = await db
    .delete(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, req.params.id))
    .returning({ id: subscriptionPlansTable.id });
  if (!deleted) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json({ data: { id: deleted.id } });
});

// ─── Manual (comp) plan activation for an account ─────────────────────────────
// Grants a plan's tier to an org for free, with an optional expiry. Goes through
// the single authoritative activateSubscription path (audit row + tier limits).
router.post("/orgs/:id/activate-plan", async (req, res) => {
  const { planId, expiresAt } = req.body as { planId?: string; expiresAt?: string | null };
  if (!planId) { res.status(400).json({ error: "planId is required" }); return; }

  const [plan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, planId))
    .limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  if (!plan.active) { res.status(400).json({ error: "Cannot activate an inactive plan" }); return; }

  let periodEnd: Date | null = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "expiresAt is not a valid date" }); return; }
    if (d.getTime() <= Date.now()) { res.status(400).json({ error: "expiresAt must be in the future" }); return; }
    periodEnd = d;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.orgId, req.params.id))
    .limit(1);
  if (!sub) { res.status(404).json({ error: "Subscription not found for this org" }); return; }
  // A live Stripe subscription is driven by Stripe's own webhooks and is exempt
  // from the expiry downgrade. A manual grant over it would be silently
  // overwritten on the next renewal and its expiry would never fire, so refuse.
  if (sub.stripeSubscriptionId) {
    res.status(409).json({
      error: "This account has an active Stripe subscription — cancel it before granting a plan manually",
    });
    return;
  }

  await activateSubscription({
    orgId: req.params.id,
    tier: plan.tier as Tier,
    provider: "manual",
    providerRef: randomUUID(),
    planKey: plan.key,
    interval: "one_time",
    amount: "0.00",
    currency: "usd",
    periodStart: new Date(),
    periodEnd,
    metadata: {
      grantedBy: "operator",
      planId: plan.id,
      planKey: plan.key,
      expiresAt: periodEnd?.toISOString() ?? null,
    },
  });

  const [updated] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.orgId, req.params.id))
    .limit(1);
  res.json({
    data: {
      orgId: req.params.id,
      tier: updated?.tier,
      status: updated?.status,
      currentPeriodEnd: updated?.currentPeriodEnd ?? null,
      planKey: plan.key,
    },
  });
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
