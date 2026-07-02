import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { predictionMarketsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { AdminCreateMarketBody, AdminUpdateMarketBody, AdminUpdateMarketSettingsBody } from "@workspace/api-zod";
import {
  serializeMarkets,
  getMarketSettings,
  updateMarketSettings,
  generateMarketsNow,
} from "../../lib/markets";
import { logger } from "../../lib/logger";

/**
 * Admin guard — same Phase 1 stopgap as routes/v1/admin.ts.
 * Fail closed when ADMIN_INTERNAL_TOKEN is not configured.
 */
const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(503).json({
      error: "Admin routes are disabled until ADMIN_INTERNAL_TOKEN is configured (required before Phase 4 auth)",
    });
    return;
  }
  const provided = (req.headers["x-admin-token"] as string | undefined) ?? req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (provided !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Invalid or missing admin token" });
    return;
  }
  next();
}

const router = Router();
router.use(requireAdminToken);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/v1/admin/markets ───────────────────────────────────────────────
router.get("/markets", async (_req, res) => {
  const rows = await db
    .select()
    .from(predictionMarketsTable)
    .orderBy(desc(predictionMarketsTable.createdAt));
  res.json({ data: await serializeMarkets(rows) });
});

// ─── POST /api/v1/admin/markets ──────────────────────────────────────────────
router.post("/markets", async (req, res) => {
  const parsed = AdminCreateMarketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid market payload", details: parsed.error.issues });
    return;
  }
  const { question, description, category, options, closesAt } = parsed.data;

  const [created] = await db
    .insert(predictionMarketsTable)
    .values({
      question,
      description: description ?? null,
      category,
      options,
      status: "open",
      source: "manual",
      closesAt: closesAt ? new Date(closesAt) : null,
    })
    .returning();

  const [serialized] = await serializeMarkets([created!]);
  res.status(201).json(serialized);
});

// ─── POST /api/v1/admin/markets/generate ─────────────────────────────────────
router.post("/markets/generate", async (_req, res) => {
  try {
    const result = await generateMarketsNow();
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Manual market generation failed");
    res.status(400).json({ error: msg });
  }
});

// ─── PATCH /api/v1/admin/markets/:id ─────────────────────────────────────────
router.patch("/markets/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const parsed = AdminUpdateMarketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update payload", details: parsed.error.issues });
    return;
  }
  const { question, description, category, status, resolvedOption, closesAt } = parsed.data;

  const existing = await db
    .select()
    .from(predictionMarketsTable)
    .where(eq(predictionMarketsTable.id, req.params.id))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  if (resolvedOption !== undefined) {
    const optionCount = Array.isArray(existing[0].options) ? existing[0].options.length : 0;
    if (!Number.isInteger(resolvedOption) || resolvedOption < 0 || resolvedOption >= optionCount) {
      res.status(400).json({ error: `resolvedOption must be an integer between 0 and ${optionCount - 1}` });
      return;
    }
  }

  const [updated] = await db
    .update(predictionMarketsTable)
    .set({
      ...(question !== undefined ? { question } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(resolvedOption !== undefined ? { resolvedOption, status: "resolved" } : {}),
      ...(closesAt !== undefined ? { closesAt: closesAt ? new Date(closesAt) : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(predictionMarketsTable.id, req.params.id))
    .returning();

  const [serialized] = await serializeMarkets([updated!]);
  res.json(serialized);
});

// ─── DELETE /api/v1/admin/markets/:id ────────────────────────────────────────
router.delete("/markets/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const result = await db
    .delete(predictionMarketsTable)
    .where(eq(predictionMarketsTable.id, req.params.id))
    .returning({ id: predictionMarketsTable.id });

  if (!result[0]) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.status(204).send();
});

// ─── GET /api/v1/admin/market-settings ───────────────────────────────────────
router.get("/market-settings", async (_req, res) => {
  res.json(await getMarketSettings());
});

// ─── PUT /api/v1/admin/market-settings ───────────────────────────────────────
router.put("/market-settings", async (req, res) => {
  const parsed = AdminUpdateMarketSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings payload", details: parsed.error.issues });
    return;
  }
  const settings = await updateMarketSettings(parsed.data);
  res.json(settings);
});

export default router;
