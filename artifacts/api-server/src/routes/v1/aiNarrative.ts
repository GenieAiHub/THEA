import { Router } from "express";
import { db } from "@workspace/db";
import { aiNarrativePromptsTable, aiNarrativeRunsTable } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireTier } from "../../middlewares/featureGate";
import {
  seedPromptsForOrg,
  getNarrativeOverview,
  getNarrativeTimeline,
  getOrgTier,
  AI_NARRATIVE_PROMPT_CAPS,
  STALE_RUN_MS,
} from "../../lib/aiNarrative";
import { checkDailySpendCap } from "../../lib/analysis";
import { getQueues } from "../../lib/queues";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);
router.use(requireTier("pro"));

const VALID_ENTITY_TYPES = ["brand", "competitor", "person", "keyword"];

// ─── GET /api/v1/ai-narrative/prompts ─────────────────────────────────────────
// Lists tracked prompts; seeds from watchlist brand/competitor keywords on
// first access so the feature works out of the box.
router.get("/prompts", async (req, res) => {
  const orgId = req.thea!.org.id;
  const seeded = await seedPromptsForOrg(orgId);

  const prompts = await db
    .select()
    .from(aiNarrativePromptsTable)
    .where(eq(aiNarrativePromptsTable.orgId, orgId))
    .orderBy(desc(aiNarrativePromptsTable.createdAt));

  const cap = AI_NARRATIVE_PROMPT_CAPS[req.thea!.tier] ?? 0;
  res.json({ data: prompts, total: prompts.length, seeded, promptCap: cap });
});

// ─── POST /api/v1/ai-narrative/prompts ────────────────────────────────────────
router.post("/prompts", requireRole("owner", "admin"), async (req, res) => {
  const { entity, entityType = "brand", promptText } = req.body as {
    entity?: string;
    entityType?: string;
    promptText?: string;
  };

  if (!entity?.trim() || !promptText?.trim()) {
    res.status(400).json({ error: "entity and promptText are required" });
    return;
  }
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    res.status(400).json({ error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` });
    return;
  }

  const [created] = await db
    .insert(aiNarrativePromptsTable)
    .values({
      orgId: req.thea!.org.id,
      entity: entity.trim(),
      entityType,
      promptText: promptText.trim(),
    })
    .returning();

  res.status(201).json({ data: created });
});

// ─── PATCH /api/v1/ai-narrative/prompts/:id ───────────────────────────────────
router.patch("/prompts/:id", requireRole("owner", "admin"), async (req, res) => {
  const { entity, entityType, promptText, isActive } = req.body as {
    entity?: string;
    entityType?: string;
    promptText?: string;
    isActive?: boolean;
  };

  if (entityType !== undefined && !VALID_ENTITY_TYPES.includes(entityType)) {
    res.status(400).json({ error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (entity !== undefined) updates.entity = String(entity).trim();
  if (entityType !== undefined) updates.entityType = entityType;
  if (promptText !== undefined) updates.promptText = String(promptText).trim();
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const [updated] = await db
    .update(aiNarrativePromptsTable)
    .set(updates)
    .where(
      and(
        eq(aiNarrativePromptsTable.id, req.params.id as string),
        eq(aiNarrativePromptsTable.orgId, req.thea!.org.id),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json({ data: updated });
});

// ─── DELETE /api/v1/ai-narrative/prompts/:id ──────────────────────────────────
router.delete("/prompts/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(aiNarrativePromptsTable)
    .where(
      and(
        eq(aiNarrativePromptsTable.id, req.params.id as string),
        eq(aiNarrativePromptsTable.orgId, req.thea!.org.id),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.status(204).send();
});

// ─── POST /api/v1/ai-narrative/run ────────────────────────────────────────────
// Queues a manual run (runs are minutes-long — always async via the queue).
router.post("/run", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;

  // Only a genuinely fresh "running" run blocks a new one — runs stuck in
  // "running" past STALE_RUN_MS (crashed process) are ignored here and get
  // swept to "failed" by the hourly scheduler tick.
  const staleCutoff = new Date(Date.now() - STALE_RUN_MS);
  const [runningRun] = await db
    .select({ id: aiNarrativeRunsTable.id })
    .from(aiNarrativeRunsTable)
    .where(
      and(
        eq(aiNarrativeRunsTable.orgId, orgId),
        eq(aiNarrativeRunsTable.status, "running"),
        gte(aiNarrativeRunsTable.startedAt, staleCutoff),
      ),
    )
    .limit(1);
  if (runningRun) {
    res.status(409).json({ error: "A narrative run is already in progress for your organisation" });
    return;
  }

  const spend = await checkDailySpendCap();
  if (!spend.withinCap) {
    res.status(429).json({ error: "The platform's daily AI budget has been reached — try again tomorrow" });
    return;
  }

  await getQueues().aiNarrative.add("ai-narrative-run", { orgId, trigger: "manual" });
  logger.info({ orgId }, "Manual AI narrative run queued");
  res.status(202).json({ queued: true });
});

// ─── GET /api/v1/ai-narrative/overview ────────────────────────────────────────
router.get("/overview", async (req, res) => {
  const overview = await getNarrativeOverview(req.thea!.org.id);
  const tier = await getOrgTier(req.thea!.org.id);
  res.json({ ...overview, tier });
});

// ─── GET /api/v1/ai-narrative/timeline ────────────────────────────────────────
router.get("/timeline", async (req, res) => {
  const entity = String(req.query.entity ?? "").trim();
  if (!entity) {
    res.status(400).json({ error: "entity query parameter is required" });
    return;
  }
  const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);
  const points = await getNarrativeTimeline(req.thea!.org.id, entity, days);
  res.json({ data: points, entity, days });
});

// ─── GET /api/v1/ai-narrative/runs ────────────────────────────────────────────
router.get("/runs", async (req, res) => {
  const runs = await db
    .select()
    .from(aiNarrativeRunsTable)
    .where(eq(aiNarrativeRunsTable.orgId, req.thea!.org.id))
    .orderBy(desc(aiNarrativeRunsTable.startedAt))
    .limit(20);
  res.json({ data: runs, total: runs.length });
});

export default router;
