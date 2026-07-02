import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status, severity, limit = "50" } = req.query as Record<string, string>;
  const orgId = req.thea!.org.id;

  const conditions: ReturnType<typeof eq>[] = [eq(alertsTable.orgId, orgId)];
  if (status) conditions.push(eq(alertsTable.status, status));
  if (severity) conditions.push(eq(alertsTable.severity, severity));

  const alerts = await db
    .select()
    .from(alertsTable)
    .where(and(...conditions))
    .orderBy(desc(alertsTable.createdAt))
    .limit(Math.min(200, parseInt(limit, 10)));

  res.json({ data: alerts });
});

router.get("/:id", async (req, res) => {
  const [alert] = await db
    .select()
    .from(alertsTable)
    .where(and(eq(alertsTable.id, req.params.id), eq(alertsTable.orgId, req.thea!.org.id)))
    .limit(1);

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(alert);
});

router.patch("/:id/resolve", async (req, res) => {
  const [updated] = await db
    .update(alertsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(alertsTable.id, req.params.id), eq(alertsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(updated);
});

export default router;
