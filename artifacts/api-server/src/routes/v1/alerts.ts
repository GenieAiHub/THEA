import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { desc, eq, and, gt, or, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status, severity, limit = "50" } = req.query as Record<string, string>;
  const orgId = req.thea!.org.id;

  const conditions: ReturnType<typeof eq>[] = [eq(alertsTable.orgId, orgId)];
  if (status) {
    // Treat "open" as matching both "open" and legacy "new" rows for backward compat
    if (status === "open") {
      conditions.push(inArray(alertsTable.status, ["open", "new"]) as any);
    } else {
      conditions.push(eq(alertsTable.status, status));
    }
  }
  if (severity) conditions.push(eq(alertsTable.severity, severity));

  const alerts = await db
    .select()
    .from(alertsTable)
    .where(and(...conditions))
    .orderBy(desc(alertsTable.createdAt))
    .limit(Math.min(200, parseInt(limit, 10)));

  res.json({ data: alerts });
});

/**
 * Server-Sent Events stream for real-time alert notifications.
 * Clients connect once and receive new critical/high alerts as they arrive.
 * Polls DB every 15s; sends only alerts newer than connection time.
 */
router.get("/stream", async (req, res) => {
  const orgId = req.thea!.org.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("connected", { ts: Date.now() });

  let lastSeenAt = new Date();

  const poll = async () => {
    try {
      const since = lastSeenAt;
      lastSeenAt = new Date();
      const fresh = await db
        .select()
        .from(alertsTable)
        .where(
          and(
            eq(alertsTable.orgId, orgId),
            eq(alertsTable.status, "open"),
            gt(alertsTable.createdAt, since),
          ),
        )
        .orderBy(desc(alertsTable.createdAt))
        .limit(20);

      fresh.forEach((alert) => sendEvent("alert", alert));
    } catch {
      // DB error: skip this poll cycle silently
    }
  };

  const intervalId = setInterval(poll, 15_000);

  req.on("close", () => {
    clearInterval(intervalId);
    res.end();
  });
});

router.get("/:id", async (req, res) => {
  const [alert] = await db
    .select()
    .from(alertsTable)
    .where(and(eq(alertsTable.id, req.params.id as string), eq(alertsTable.orgId, req.thea!.org.id)))
    .limit(1);

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(alert);
});

/** Resolving an alert is a write — analyst is read-only */
router.patch("/:id/resolve", requireRole("owner", "admin"), async (req, res) => {
  const [updated] = await db
    .update(alertsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(alertsTable.id, req.params.id as string), eq(alertsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(updated);
});

/** Dismiss an alert (moves to dismissed status without escalation) */
router.patch("/:id/dismiss", requireRole("owner", "admin", "analyst"), async (req, res) => {
  const [updated] = await db
    .update(alertsTable)
    .set({ status: "dismissed" })
    .where(and(eq(alertsTable.id, req.params.id as string), eq(alertsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(updated);
});

export default router;
