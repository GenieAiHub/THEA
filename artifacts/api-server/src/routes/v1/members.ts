import { Router } from "express";
import { db } from "@workspace/db";
import { membersTable, faceEmbeddingsTable } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { computeDescriptor } from "../../lib/faceRecognition";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

const CONSENT_VERSION = "1.0";

function decodeBase64Jpeg(input: string): Buffer {
  const comma = input.indexOf(",");
  const b64 = input.startsWith("data:") && comma >= 0 ? input.slice(comma + 1) : input;
  return Buffer.from(b64, "base64");
}

// ─── GET /api/v1/members ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const rows = await db
    .select({ member: membersTable, faceCount: count(faceEmbeddingsTable.id) })
    .from(membersTable)
    .leftJoin(faceEmbeddingsTable, eq(faceEmbeddingsTable.memberId, membersTable.id))
    .where(eq(membersTable.orgId, req.thea!.org.id))
    .groupBy(membersTable.id)
    .orderBy(desc(membersTable.createdAt));

  const data = rows.map((r) => ({ ...r.member, faceCount: Number(r.faceCount) }));
  res.json({ data, total: data.length });
});

// ─── POST /api/v1/members ─────────────────────────────────────────────────────
router.post("/", requireRole("owner", "admin"), async (req, res) => {
  const { fullName, email, phone, externalRef, notes, consentGiven } = req.body as {
    fullName?: string;
    email?: string;
    phone?: string;
    externalRef?: string;
    notes?: string;
    consentGiven?: boolean;
  };

  if (!fullName || !fullName.trim()) {
    res.status(400).json({ error: "fullName is required" });
    return;
  }

  const [created] = await db
    .insert(membersTable)
    .values({
      orgId: req.thea!.org.id,
      fullName: fullName.trim(),
      email: email ?? null,
      phone: phone ?? null,
      externalRef: externalRef ?? null,
      notes: notes ?? null,
      consentGivenAt: consentGiven ? new Date() : null,
      consentVersion: consentGiven ? CONSENT_VERSION : null,
    })
    .returning();

  res.status(201).json(created);
});

// ─── GET /api/v1/members/:id ──────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const [member] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.id, req.params.id as string), eq(membersTable.orgId, req.thea!.org.id)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const faces = await db
    .select({ id: faceEmbeddingsTable.id, quality: faceEmbeddingsTable.quality, createdAt: faceEmbeddingsTable.createdAt })
    .from(faceEmbeddingsTable)
    .where(eq(faceEmbeddingsTable.memberId, member.id))
    .orderBy(desc(faceEmbeddingsTable.createdAt));

  res.json({ ...member, faces });
});

// ─── PATCH /api/v1/members/:id ────────────────────────────────────────────────
router.patch("/:id", requireRole("owner", "admin"), async (req, res) => {
  const { fullName, email, phone, externalRef, notes, status } = req.body as {
    fullName?: string;
    email?: string;
    phone?: string;
    externalRef?: string;
    notes?: string;
    status?: string;
  };

  const [updated] = await db
    .update(membersTable)
    .set({
      ...(fullName !== undefined ? { fullName } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(externalRef !== undefined ? { externalRef } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status !== undefined ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(membersTable.id, req.params.id as string), eq(membersTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(updated);
});

// ─── POST /api/v1/members/:id/consent ─────────────────────────────────────────
// Records explicit biometric consent. Required before any face may be enrolled.
router.post("/:id/consent", requireRole("owner", "admin"), async (req, res) => {
  const [updated] = await db
    .update(membersTable)
    .set({ consentGivenAt: new Date(), consentVersion: CONSENT_VERSION, updatedAt: new Date() })
    .where(and(eq(membersTable.id, req.params.id as string), eq(membersTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(updated);
});

// ─── DELETE /api/v1/members/:id ───────────────────────────────────────────────
// Cascades to face_embeddings (right-to-be-forgotten).
router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(membersTable)
    .where(and(eq(membersTable.id, req.params.id as string), eq(membersTable.orgId, req.thea!.org.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.status(204).send();
});

// ─── POST /api/v1/members/:id/face ────────────────────────────────────────────
// Enroll a face photo for a member. Consent-gated. Body: { imageBase64 }.
router.post("/:id/face", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.id, req.params.id as string), eq(membersTable.orgId, orgId)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  if (!member.consentGivenAt) {
    res.status(409).json({ error: "Biometric consent has not been recorded for this member. Record consent before enrolling a face." });
    return;
  }

  let descriptorResult;
  try {
    descriptorResult = await computeDescriptor(decodeBase64Jpeg(imageBase64));
  } catch (err) {
    logger.warn({ err }, "Face enrollment: failed to decode/process image");
    res.status(422).json({ error: "Could not process the image. Ensure it is a valid JPEG photo." });
    return;
  }

  if (!descriptorResult) {
    res.status(422).json({ error: "No face detected in the photo. Try again with a clear, well-lit, front-facing photo." });
    return;
  }

  const [created] = await db
    .insert(faceEmbeddingsTable)
    .values({
      orgId,
      memberId: member.id,
      embedding: descriptorResult.descriptor,
      quality: descriptorResult.score,
    })
    .returning({ id: faceEmbeddingsTable.id, quality: faceEmbeddingsTable.quality, createdAt: faceEmbeddingsTable.createdAt });

  const [{ value: embeddingCount }] = await db
    .select({ value: count() })
    .from(faceEmbeddingsTable)
    .where(eq(faceEmbeddingsTable.memberId, member.id));

  res.status(201).json({ face: created, embeddingCount: Number(embeddingCount) });
});

// ─── DELETE /api/v1/members/:id/face/:faceId ──────────────────────────────────
router.delete("/:id/face/:faceId", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(faceEmbeddingsTable)
    .where(
      and(
        eq(faceEmbeddingsTable.id, req.params.faceId as string),
        eq(faceEmbeddingsTable.memberId, req.params.id as string),
        eq(faceEmbeddingsTable.orgId, req.thea!.org.id),
      ),
    )
    .returning({ id: faceEmbeddingsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Face not found" });
    return;
  }
  res.status(204).send();
});

export default router;
