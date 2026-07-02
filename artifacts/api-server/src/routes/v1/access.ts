import { Router } from "express";
import { db, pool } from "@workspace/db";
import { accessPointsTable, accessGrantsTable, accessEventsTable, membersTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { computeDescriptor, FACE_MATCH_THRESHOLD } from "../../lib/faceRecognition";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

function decodeBase64Jpeg(input: string): Buffer {
  const comma = input.indexOf(",");
  const b64 = input.startsWith("data:") && comma >= 0 ? input.slice(comma + 1) : input;
  return Buffer.from(b64, "base64");
}

// ─── Access points ────────────────────────────────────────────────────────────
router.get("/points", async (req, res) => {
  const points = await db
    .select()
    .from(accessPointsTable)
    .where(eq(accessPointsTable.orgId, req.thea!.org.id))
    .orderBy(desc(accessPointsTable.createdAt));
  res.json({ data: points, total: points.length });
});

router.post("/points", requireRole("owner", "admin"), async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [created] = await db
    .insert(accessPointsTable)
    .values({ orgId: req.thea!.org.id, name: name.trim(), description: description ?? null })
    .returning();
  res.status(201).json(created);
});

router.patch("/points/:id", requireRole("owner", "admin"), async (req, res) => {
  const { name, description, isActive } = req.body as { name?: string; description?: string; isActive?: boolean };
  const [updated] = await db
    .update(accessPointsTable)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(accessPointsTable.id, req.params.id as string), eq(accessPointsTable.orgId, req.thea!.org.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Access point not found" });
    return;
  }
  res.json(updated);
});

router.delete("/points/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(accessPointsTable)
    .where(and(eq(accessPointsTable.id, req.params.id as string), eq(accessPointsTable.orgId, req.thea!.org.id)))
    .returning({ id: accessPointsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Access point not found" });
    return;
  }
  res.status(204).send();
});

// ─── Access grants ──────────────────────────────────────────────────────────
router.get("/grants", async (req, res) => {
  const { memberId, accessPointId } = req.query as { memberId?: string; accessPointId?: string };
  const conditions = [eq(accessGrantsTable.orgId, req.thea!.org.id)];
  if (memberId) conditions.push(eq(accessGrantsTable.memberId, memberId));
  if (accessPointId) conditions.push(eq(accessGrantsTable.accessPointId, accessPointId));

  const grants = await db
    .select({
      id: accessGrantsTable.id,
      memberId: accessGrantsTable.memberId,
      accessPointId: accessGrantsTable.accessPointId,
      isActive: accessGrantsTable.isActive,
      validFrom: accessGrantsTable.validFrom,
      validUntil: accessGrantsTable.validUntil,
      createdAt: accessGrantsTable.createdAt,
      memberName: membersTable.fullName,
      accessPointName: accessPointsTable.name,
    })
    .from(accessGrantsTable)
    .leftJoin(membersTable, eq(membersTable.id, accessGrantsTable.memberId))
    .leftJoin(accessPointsTable, eq(accessPointsTable.id, accessGrantsTable.accessPointId))
    .where(and(...conditions))
    .orderBy(desc(accessGrantsTable.createdAt));

  res.json({ data: grants, total: grants.length });
});

router.post("/grants", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;
  const { memberId, accessPointId } = req.body as { memberId?: string; accessPointId?: string };
  if (!memberId || !accessPointId) {
    res.status(400).json({ error: "memberId and accessPointId are required" });
    return;
  }

  // Validate both belong to the org.
  const [member] = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(and(eq(membersTable.id, memberId), eq(membersTable.orgId, orgId)))
    .limit(1);
  const [point] = await db
    .select({ id: accessPointsTable.id })
    .from(accessPointsTable)
    .where(and(eq(accessPointsTable.id, accessPointId), eq(accessPointsTable.orgId, orgId)))
    .limit(1);
  if (!member || !point) {
    res.status(404).json({ error: "Member or access point not found" });
    return;
  }

  const [created] = await db
    .insert(accessGrantsTable)
    .values({ orgId, memberId, accessPointId })
    .onConflictDoUpdate({
      target: [accessGrantsTable.memberId, accessGrantsTable.accessPointId],
      set: { isActive: true, updatedAt: new Date() },
    })
    .returning();

  res.status(201).json(created);
});

router.delete("/grants/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(accessGrantsTable)
    .where(and(eq(accessGrantsTable.id, req.params.id as string), eq(accessGrantsTable.orgId, req.thea!.org.id)))
    .returning({ id: accessGrantsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Grant not found" });
    return;
  }
  res.status(204).send();
});

// ─── Identify (scan → match → access decision) ────────────────────────────────
// Body: { imageBase64, accessPointId }. ALWAYS writes an access_event.
router.post("/identify", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { imageBase64, accessPointId } = req.body as { imageBase64?: string; accessPointId?: string };

  if (!imageBase64 || !accessPointId) {
    res.status(400).json({ error: "imageBase64 and accessPointId are required" });
    return;
  }

  // Access point must exist, belong to the org, and be active.
  const [point] = await db
    .select()
    .from(accessPointsTable)
    .where(and(eq(accessPointsTable.id, accessPointId), eq(accessPointsTable.orgId, orgId)))
    .limit(1);
  if (!point) {
    res.status(404).json({ error: "Access point not found" });
    return;
  }
  if (!point.isActive) {
    res.status(400).json({ error: "Access point is inactive" });
    return;
  }

  const writeEvent = async (
    decision: "granted" | "denied",
    reason: string,
    memberId: string | null,
    distance: number | null,
  ) => {
    await db.insert(accessEventsTable).values({ orgId, accessPointId, memberId, decision, reason, distance });
  };

  // 1. Detect + describe the incoming face.
  let descriptorResult;
  try {
    descriptorResult = await computeDescriptor(decodeBase64Jpeg(imageBase64));
  } catch (err) {
    logger.warn({ err }, "Identify: failed to decode/process image");
    res.status(422).json({ error: "Could not process the image. Ensure it is a valid JPEG photo." });
    return;
  }

  if (!descriptorResult) {
    await writeEvent("denied", "no_face_detected", null, null);
    res.json({ decision: "denied", reason: "no_face_detected", member: null, distance: null, accessPoint: { id: point.id, name: point.name } });
    return;
  }

  // 2. Nearest-neighbour search scoped to the org (L2 distance).
  const vectorStr = `[${descriptorResult.descriptor.join(",")}]`;
  const client = await pool.connect();
  let nearest: { memberId: string; distance: number } | null = null;
  try {
    const result = await client.query(
      `SELECT member_id, embedding <-> $1::vector AS distance
       FROM face_embeddings
       WHERE org_id = $2
       ORDER BY embedding <-> $1::vector
       LIMIT 1`,
      [vectorStr, orgId],
    );
    if (result.rows.length > 0) {
      nearest = { memberId: String(result.rows[0].member_id), distance: Number(result.rows[0].distance) };
    }
  } finally {
    client.release();
  }

  if (!nearest || nearest.distance > FACE_MATCH_THRESHOLD) {
    await writeEvent("denied", "no_match", null, nearest ? nearest.distance : null);
    res.json({ decision: "denied", reason: "no_match", member: null, distance: nearest ? nearest.distance : null, accessPoint: { id: point.id, name: point.name } });
    return;
  }

  // 3. Matched a member — check for an active access grant at this point.
  const [grant] = await db
    .select({ id: accessGrantsTable.id })
    .from(accessGrantsTable)
    .where(
      and(
        eq(accessGrantsTable.orgId, orgId),
        eq(accessGrantsTable.memberId, nearest.memberId),
        eq(accessGrantsTable.accessPointId, accessPointId),
        eq(accessGrantsTable.isActive, true),
        sql`(${accessGrantsTable.validFrom} IS NULL OR ${accessGrantsTable.validFrom} <= now())`,
        sql`(${accessGrantsTable.validUntil} IS NULL OR ${accessGrantsTable.validUntil} >= now())`,
      ),
    )
    .limit(1);

  const [member] = await db
    .select({ id: membersTable.id, fullName: membersTable.fullName, status: membersTable.status })
    .from(membersTable)
    .where(and(eq(membersTable.id, nearest.memberId), eq(membersTable.orgId, orgId)))
    .limit(1);

  const suspended = member?.status && member.status !== "active";

  if (!grant || suspended) {
    const reason = suspended ? "member_suspended" : "no_grant";
    await writeEvent("denied", reason, nearest.memberId, nearest.distance);
    res.json({
      decision: "denied",
      reason,
      member: member ? { id: member.id, fullName: member.fullName } : null,
      distance: nearest.distance,
      accessPoint: { id: point.id, name: point.name },
    });
    return;
  }

  await writeEvent("granted", "matched", nearest.memberId, nearest.distance);
  res.json({
    decision: "granted",
    reason: "matched",
    member: member ? { id: member.id, fullName: member.fullName } : null,
    distance: nearest.distance,
    accessPoint: { id: point.id, name: point.name },
  });
});

// ─── Access events (audit log) ────────────────────────────────────────────────
router.get("/events", async (req, res) => {
  const { limit } = req.query as { limit?: string };
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));

  const events = await db
    .select({
      id: accessEventsTable.id,
      decision: accessEventsTable.decision,
      reason: accessEventsTable.reason,
      distance: accessEventsTable.distance,
      createdAt: accessEventsTable.createdAt,
      memberId: accessEventsTable.memberId,
      memberName: membersTable.fullName,
      accessPointId: accessEventsTable.accessPointId,
      accessPointName: accessPointsTable.name,
    })
    .from(accessEventsTable)
    .leftJoin(membersTable, eq(membersTable.id, accessEventsTable.memberId))
    .leftJoin(accessPointsTable, eq(accessPointsTable.id, accessEventsTable.accessPointId))
    .where(eq(accessEventsTable.orgId, req.thea!.org.id))
    .orderBy(desc(accessEventsTable.createdAt))
    .limit(safeLimit);

  res.json({ data: events, total: events.length });
});

export default router;
