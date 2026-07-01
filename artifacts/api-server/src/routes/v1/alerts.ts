import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { status, severity, limit = "50" } = req.query as Record<string, string>;

  const alerts = await db
    .select()
    .from(alertsTable)
    .orderBy(desc(alertsTable.createdAt))
    .limit(Math.min(200, parseInt(limit, 10)));

  const filtered = alerts.filter((a) => {
    if (status && a.status !== status) return false;
    if (severity && a.severity !== severity) return false;
    return true;
  });

  res.json({ data: filtered });
});

router.get("/:id", async (req, res) => {
  const [alert] = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.id, req.params.id))
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
    .where(eq(alertsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(updated);
});

export default router;
