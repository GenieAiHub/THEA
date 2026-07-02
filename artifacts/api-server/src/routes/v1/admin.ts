import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { organizationsTable, subscriptionsTable, collectionRunsTable, llmUsageLogsTable } from "@workspace/db/schema";
import { desc, count } from "drizzle-orm";

const router = Router();

/**
 * Temporary internal-only guard for admin routes (Phase 1 stopgap).
 * Set ADMIN_INTERNAL_TOKEN in the environment to require it as a Bearer token.
 * Auth is fully replaced in Phase 4 (JWT / Clerk RBAC).
 */
const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  // Fail closed: if no token is configured, deny ALL requests.
  // Never fall back to IP-based checks — trust proxy makes req.ip spoofable.
  if (!ADMIN_TOKEN) {
    res.status(503).json({
      error: "Admin routes are disabled until ADMIN_INTERNAL_TOKEN is configured (required before Phase 4 auth)",
    });
    return;
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (provided !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Invalid or missing admin token" });
    return;
  }
  next();
}

router.use(requireAdminToken);

router.get("/orgs", async (_req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  res.json({ data: orgs });
});

router.get("/subscriptions", async (_req, res) => {
  const subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt));
  res.json({ data: subs });
});

router.get("/llm-usage", async (_req, res) => {
  const recent = await db
    .select()
    .from(llmUsageLogsTable)
    .orderBy(desc(llmUsageLogsTable.createdAt))
    .limit(100);
  res.json({ data: recent });
});

router.get("/collection-runs", async (_req, res) => {
  const runs = await db
    .select()
    .from(collectionRunsTable)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(100);
  res.json({ data: runs });
});

router.get("/stats", async (_req, res) => {
  const [orgCount] = await db.select({ count: count() }).from(organizationsTable);

  res.json({
    organizations: orgCount?.count ?? 0,
    timestamp: new Date().toISOString(),
  });
});

export default router;
