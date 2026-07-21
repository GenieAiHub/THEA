import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable, usersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { isExpoPushToken } from "../../lib/watch/pushSightings";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

const PLATFORMS = new Set(["ios", "android", "unknown"]);

async function getUserPref(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ pushSightingAlerts: usersTable.pushSightingAlerts })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user?.pushSightingAlerts ?? true;
}

// ─── POST /api/v1/push/register ──────────────────────────────────────────────
// Registers (or re-assigns) this device's Expo push token to the caller.
// Token rows are pure device registrations; the sighting-alert opt-in lives
// on users.push_sighting_alerts so it survives logout/login.
router.post("/register", async (req, res) => {
  const { token, platform } = (req.body ?? {}) as { token?: string; platform?: string };
  if (typeof token !== "string" || !isExpoPushToken(token)) {
    res.status(400).json({ error: "A valid Expo push token is required" });
    return;
  }
  const userId = req.thea!.user.id;
  const orgId = req.thea!.org.id;
  const plat = PLATFORMS.has(platform ?? "") ? (platform as string) : "unknown";

  const [row] = await db
    .insert(pushTokensTable)
    .values({ userId, orgId, token, platform: plat })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId, orgId, platform: plat, lastSeenAt: new Date() },
    })
    .returning();

  logger.info({ userId, platform: plat }, "Push token registered");
  res.status(201).json({ data: { id: row!.id, sightingAlerts: await getUserPref(userId) } });
});

// ─── DELETE /api/v1/push/register ────────────────────────────────────────────
// Removes this device's token (called on sign-out). Does NOT touch the user's
// opt-in preference.
router.delete("/register", async (req, res) => {
  const { token } = (req.body ?? {}) as { token?: string };
  if (typeof token !== "string" || token.length === 0) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.token, token), eq(pushTokensTable.userId, req.thea!.user.id)));
  res.json({ ok: true });
});

// ─── GET /api/v1/push/preferences ────────────────────────────────────────────
router.get("/preferences", async (req, res) => {
  const userId = req.thea!.user.id;
  const [sightingAlerts, [devices]] = await Promise.all([
    getUserPref(userId),
    db.select({ n: count(pushTokensTable.id) }).from(pushTokensTable).where(eq(pushTokensTable.userId, userId)),
  ]);
  res.json({ data: { sightingAlerts, deviceCount: Number(devices?.n ?? 0) } });
});

// ─── PATCH /api/v1/push/preferences ──────────────────────────────────────────
// Per-user opt-in/opt-out, applies across every device the user signs in on.
router.patch("/preferences", async (req, res) => {
  const { sightingAlerts } = (req.body ?? {}) as { sightingAlerts?: unknown };
  if (typeof sightingAlerts !== "boolean") {
    res.status(400).json({ error: "sightingAlerts (boolean) is required" });
    return;
  }
  await db
    .update(usersTable)
    .set({ pushSightingAlerts: sightingAlerts, updatedAt: new Date() })
    .where(eq(usersTable.id, req.thea!.user.id));
  res.json({ data: { sightingAlerts } });
});

export default router;
