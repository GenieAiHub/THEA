import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, campaignMeasurementsTable } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";
import { requireTier } from "../../middlewares/featureGate";
import { computeCampaignBaseline, measureCampaignDaily } from "../../lib/campaignTracker";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);
router.use(requireTier("pro"));

// ─── GET /api/v1/campaigns ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const orgId = req.thea!.org.id;

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.orgId, orgId))
    .orderBy(desc(campaignsTable.createdAt));

  res.json({ count: campaigns.length, data: campaigns });
});

// ─── POST /api/v1/campaigns ───────────────────────────────────────────────────
router.post("/", requireRole("owner", "admin"), async (req, res) => {
  const { name, targetKeywords, startDate, goal } = req.body as {
    name: string;
    targetKeywords: string[];
    startDate?: string;
    goal?: string;
  };

  if (!name || !Array.isArray(targetKeywords) || !targetKeywords.length) {
    res.status(400).json({ error: "name and targetKeywords (array) are required" });
    return;
  }

  const orgId = req.thea!.org.id;
  const launch = startDate ? new Date(startDate) : new Date();

  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      orgId,
      name,
      targetKeywords,
      startDate: launch,
      goal,
      status: "active",
    })
    .returning();

  // Compute baseline asynchronously (non-blocking)
  computeCampaignBaseline(campaign!.id).catch((err) =>
    logger.warn({ err, campaignId: campaign!.id }, "Baseline computation failed"),
  );

  res.status(201).json(campaign);
});

// ─── GET /api/v1/campaigns/:id ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const orgId = req.thea!.org.id;

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, req.params.id as string), eq(campaignsTable.orgId, orgId)));

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Fetch last 30 days of measurements
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const measurements = await db
    .select()
    .from(campaignMeasurementsTable)
    .where(
      and(
        eq(campaignMeasurementsTable.campaignId, campaign.id),
        gte(campaignMeasurementsTable.measuredAt, since30d),
      ),
    )
    .orderBy(desc(campaignMeasurementsTable.measuredAt))
    .limit(30);

  res.json({ ...campaign, measurements });
});

// ─── PATCH /api/v1/campaigns/:id ─────────────────────────────────────────────
router.patch("/:id", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;
  const { name, status, goal, targetKeywords } = req.body as {
    name?: string;
    status?: string;
    goal?: string;
    targetKeywords?: string[];
  };

  const [updated] = await db
    .update(campaignsTable)
    .set({
      ...(name && { name }),
      ...(status && { status }),
      ...(goal !== undefined && { goal }),
      ...(targetKeywords && { targetKeywords }),
      updatedAt: new Date(),
    })
    .where(and(eq(campaignsTable.id, req.params.id as string), eq(campaignsTable.orgId, orgId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(updated);
});

// ─── DELETE /api/v1/campaigns/:id ────────────────────────────────────────────
router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;

  await db
    .delete(campaignsTable)
    .where(and(eq(campaignsTable.id, req.params.id as string), eq(campaignsTable.orgId, orgId)));

  res.status(204).send();
});

// ─── GET /api/v1/campaigns/:id/measurements ───────────────────────────────────
router.get("/:id/measurements", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { days = "30" } = req.query as { days?: string };
  const daysInt = Math.min(90, Math.max(1, parseInt(days, 10) || 30));
  const since = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, req.params.id as string), eq(campaignsTable.orgId, orgId)));

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const measurements = await db
    .select()
    .from(campaignMeasurementsTable)
    .where(
      and(
        eq(campaignMeasurementsTable.campaignId, campaign.id),
        gte(campaignMeasurementsTable.measuredAt, since),
      ),
    )
    .orderBy(desc(campaignMeasurementsTable.measuredAt));

  res.json({ campaignId: campaign.id, days: daysInt, count: measurements.length, data: measurements });
});

// ─── POST /api/v1/campaigns/:id/measure ──────────────────────────────────────
/**
 * Manually trigger a measurement for a campaign.
 */
router.post("/:id/measure", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;

  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, req.params.id as string), eq(campaignsTable.orgId, orgId)));

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  try {
    const metrics = await measureCampaignDaily(campaign.id);
    res.json(metrics ?? { error: "No data available for measurement" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Measurement failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
