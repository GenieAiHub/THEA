import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { crawlerSourcesTable, collectionRunsTable } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { triggerImmediateCollection } from "../../lib/ingestion";
import { PRECONFIGURED_SOURCES, CATEGORIES } from "../../lib/ingestion/sources-config";
import { requireAuth } from "../../middlewares/auth";

const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin token not configured" });
    return;
  }
  const provided = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (provided !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const router = Router();

// ─── Authenticated: list sources (read-only) ─────────────────────────────────
router.get("/sources", requireAuth, async (req, res) => {
  const { category, type, active } = req.query as Record<string, string>;
  const conditions = [];
  if (category) conditions.push(eq(crawlerSourcesTable.category, category));
  if (type) conditions.push(eq(crawlerSourcesTable.type, type));
  if (active !== undefined) conditions.push(eq(crawlerSourcesTable.isActive, active === "true"));

  const sources = await db
    .select()
    .from(crawlerSourcesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(crawlerSourcesTable.name);
  res.json({ data: sources });
});

// ─── ADMIN: create source ─────────────────────────────────────────────────────
router.post("/sources", requireAdminToken, async (req, res) => {
  const { name, url, type = "rss", category, language = "en", country, config } = req.body as {
    name: string; url: string; type?: string; category: string;
    language?: string; country?: string; config?: Record<string, unknown>;
  };

  if (!name || !url || !category) {
    res.status(400).json({ error: "name, url, and category are required" });
    return;
  }

  const [created] = await db
    .insert(crawlerSourcesTable)
    .values({ name, url, type, category, language, country, config: config ?? {} })
    .returning();

  res.status(201).json(created);
});

// ─── ADMIN: update source ─────────────────────────────────────────────────────
router.patch("/sources/:id", requireAdminToken, async (req, res) => {
  const { isActive, config, name, url, category } = req.body as {
    isActive?: boolean; config?: Record<string, unknown>;
    name?: string; url?: string; category?: string;
  };

  const [updated] = await db
    .update(crawlerSourcesTable)
    .set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(config ? { config } : {}),
      ...(name ? { name } : {}),
      ...(url ? { url } : {}),
      ...(category ? { category } : {}),
      updatedAt: new Date(),
    })
    .where(eq(crawlerSourcesTable.id, String(req.params.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Source not found" });
    return;
  }
  res.json(updated);
});

// ─── ADMIN: delete source ─────────────────────────────────────────────────────
router.delete("/sources/:id", requireAdminToken, async (req, res) => {
  const result = await db
    .delete(crawlerSourcesTable)
    .where(eq(crawlerSourcesTable.id, String(req.params.id)))
    .returning({ id: crawlerSourcesTable.id });

  if (!result[0]) {
    res.status(404).json({ error: "Source not found" });
    return;
  }
  res.status(204).send();
});

// ─── PUBLIC: list collection runs ────────────────────────────────────────────
router.get("/runs", requireAuth, async (req, res) => {
  const { limit = "50", sourceType } = req.query as Record<string, string>;
  const conditions = [];
  if (sourceType) conditions.push(eq(collectionRunsTable.sourceType, sourceType));

  const runs = await db
    .select()
    .from(collectionRunsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(Math.min(200, parseInt(limit, 10)));
  res.json({ data: runs });
});

// ─── ADMIN: manually trigger a collection run ─────────────────────────────────
router.post("/trigger", requireAdminToken, async (req, res) => {
  const { sourceType, category, keyword, urls } = req.body as {
    sourceType: string; category?: string; keyword?: string; urls?: string[];
  };

  const validSources = [
    "rss-all", "rss-batch", "gdelt", "newsapi", "mediastack", "bing-news",
    "twitter", "reddit", "youtube", "serp", "duckduckgo", "telegram", "tiktok", "web-crawler",
  ];
  if (!sourceType || !validSources.includes(sourceType)) {
    res.status(400).json({ error: `sourceType must be one of: ${validSources.join(", ")}` });
    return;
  }

  if (sourceType === "web-crawler" && (!Array.isArray(urls) || urls.length === 0)) {
    res.status(400).json({ error: "web-crawler requires urls array" });
    return;
  }

  await triggerImmediateCollection(sourceType, category, keyword, urls);
  res.json({ queued: true, sourceType, category, keyword, urlCount: urls?.length ?? 0 });
});

// ─── ADMIN: seed preconfigured sources into DB ────────────────────────────────
router.post("/seed-sources", requireAdminToken, async (req, res) => {
  let seeded = 0;
  let skipped = 0;

  for (const source of PRECONFIGURED_SOURCES) {
    try {
      const result = await db
        .insert(crawlerSourcesTable)
        .values({
          name: source.name,
          url: source.url,
          type: "rss",
          category: source.category,
          language: source.language ?? "en",
        })
        .onConflictDoNothing()
        .returning({ id: crawlerSourcesTable.id });

      if (result.length > 0) seeded++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  res.json({ seeded, skipped, total: PRECONFIGURED_SOURCES.length });
});

// ─── PUBLIC: list categories ──────────────────────────────────────────────────
router.get("/categories", requireAuth, (_req, res) => {
  res.json({ data: CATEGORIES });
});

export default router;
