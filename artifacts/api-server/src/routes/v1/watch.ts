import { Router, json } from "express";
import busboy from "busboy";
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { db, pool } from "@workspace/db";
import {
  watchCamerasTable,
  watchTargetsTable,
  watchTargetImagesTable,
  watchSightingsTable,
  watchVideoJobsTable,
  membersTable,
  type WatchAlertChannels,
} from "@workspace/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { computeDescriptor, FACE_MATCH_THRESHOLD } from "../../lib/faceRecognition";
import { analyzeFrame } from "../../lib/watch/frameProcessor";
import { detectObjects, computeObjectEmbedding, VEHICLE_CLASSES } from "../../lib/watch/objectRecognition";
import { decodeJpegToRgb, cropRgb } from "../../lib/watch/imageOps";
import { normalizePlate } from "../../lib/watch/plateOcr";
import { validateStreamUrl, probeFfmpeg, captureFrame } from "../../lib/watch/ffmpeg";
import { maskStreamUrl, redactStreamCredentials, MASKED_CREDENTIALS } from "../../lib/watch/mask";
import { isSamplerRunning } from "../../lib/watch/cameraSampler";
import { buildDvrChannelUrl, isDvrBrand, type DvrStreamQuality } from "../../lib/watch/dvr";
import { startLiveStream, touchLiveStream, stopLiveStream, LiveStreamCapacityError } from "../../lib/watch/liveStream";
import { saveRefImage, resolveSnapshotPath } from "../../lib/watch/snapshots";
import { VIDEO_TMP_DIR } from "../../lib/watch/watchWorkers";
import { addJob } from "../../lib/queues";

const router = Router();
// Reference photos arrive as base64 JSON; the global parser caps at 2mb, so the
// watch router re-parses with a larger limit (app.ts skips global parsing here).
router.use(json({ limit: "30mb" }));
router.use(requireAuth);

const TARGET_TYPES = new Set(["person", "vehicle", "object", "plate"]);
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGES_PER_TARGET = 5;

function decodeBase64Jpeg(input: string): Buffer {
  const comma = input.indexOf(",");
  const b64 = input.startsWith("data:") && comma >= 0 ? input.slice(comma + 1) : input;
  return Buffer.from(b64, "base64");
}

function sanitizeAlertChannels(input: unknown): WatchAlertChannels {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    email: Boolean(raw.email),
    emails: Array.isArray(raw.emails) ? raw.emails.filter((e): e is string => typeof e === "string" && /.+@.+\..+/.test(e)).slice(0, 10) : [],
    webhook: Boolean(raw.webhook),
    slack: Boolean(raw.slack),
    teams: Boolean(raw.teams),
  };
}

// ─── GET /api/v1/watch/status ────────────────────────────────────────────────
router.get("/status", async (_req, res) => {
  res.json({
    liveSamplingEnabled: isSamplerRunning(),
    ffmpegAvailable: await probeFfmpeg(),
  });
});

// ─── POST /api/v1/watch/recognize ────────────────────────────────────────────
// Mobile "Recognize" feature: analyze one photo (base64 JPEG) and report what
// it contains — detected objects, faces matched against enrolled members,
// plate-text candidates, and any active watch-target matches. Read-only: no
// sightings, access events, or alerts are recorded. Available to every org
// member (not just admins) since it mutates nothing.
router.post("/recognize", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  let analysis;
  try {
    analysis = await analyzeFrame(decodeBase64Jpeg(imageBase64), orgId);
  } catch (err) {
    logger.warn({ err, orgId }, "Recognize: failed to decode/process image");
    res.status(422).json({ error: "Could not process the image. Ensure it is a valid JPEG photo." });
    return;
  }

  // Match each detected face against the org's enrolled members (same
  // pgvector nearest-neighbour search the access identify flow uses).
  const MAX_FACE_LOOKUPS = 5;
  const faces: Array<{
    score: number;
    member: { id: string; fullName: string } | null;
    distance: number | null;
  }> = [];
  const client = await pool.connect();
  try {
    for (const face of analysis.faces.slice(0, MAX_FACE_LOOKUPS)) {
      const vectorStr = `[${face.descriptor.join(",")}]`;
      const result = await client.query(
        `SELECT member_id, embedding <-> $1::vector AS distance
         FROM face_embeddings
         WHERE org_id = $2
         ORDER BY embedding <-> $1::vector
         LIMIT 1`,
        [vectorStr, orgId],
      );
      let member: { id: string; fullName: string } | null = null;
      let distance: number | null = null;
      if (result.rows.length > 0) {
        distance = Number(result.rows[0].distance);
        if (distance <= FACE_MATCH_THRESHOLD) {
          const memberId = String(result.rows[0].member_id);
          const [row] = await db
            .select({ id: membersTable.id, fullName: membersTable.fullName })
            .from(membersTable)
            .where(and(eq(membersTable.id, memberId), eq(membersTable.orgId, orgId)))
            .limit(1);
          if (row) member = row;
        }
      }
      faces.push({ score: face.score, member, distance });
    }
  } finally {
    client.release();
  }

  res.json({
    objects: analysis.objects,
    faces,
    plates: analysis.plates,
    targetMatches: analysis.targetMatches,
  });
});

// ═══ Cameras ═════════════════════════════════════════════════════════════════

// maskStreamUrl / MASKED_CREDENTIALS now live in lib/watch/mask.ts (shared
// with the sampler/live-stream pipeline so persisted errors are redacted too).

function canSeeFullStreamUrl(req: { thea?: { user: { role: string } } }): boolean {
  const role = req.thea?.user.role;
  return role === "owner" || role === "admin";
}

router.get("/cameras", async (req, res) => {
  const cameras = await db
    .select()
    .from(watchCamerasTable)
    .where(eq(watchCamerasTable.orgId, req.thea!.org.id))
    .orderBy(desc(watchCamerasTable.createdAt));
  const data = canSeeFullStreamUrl(req)
    ? cameras
    : cameras.map((cam) => ({ ...cam, streamUrl: maskStreamUrl(cam.streamUrl) }));
  res.json({ data, total: cameras.length });
});

router.post("/cameras", requireRole("owner", "admin"), async (req, res) => {
  const { name, location, streamUrl, sampleIntervalSec, isActive } = req.body as {
    name?: string; location?: string; streamUrl?: string; sampleIntervalSec?: number; isActive?: boolean;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!streamUrl?.trim()) { res.status(400).json({ error: "streamUrl is required" }); return; }
  const urlError = validateStreamUrl(streamUrl.trim());
  if (urlError) { res.status(400).json({ error: urlError }); return; }
  const interval = Math.max(2, Math.min(3600, Math.round(sampleIntervalSec ?? 3)));

  const [created] = await db
    .insert(watchCamerasTable)
    .values({
      orgId: req.thea!.org.id,
      name: name.trim(),
      location: location?.trim() || null,
      streamUrl: streamUrl.trim(),
      sampleIntervalSec: interval,
      isActive: isActive ?? true,
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/cameras/:id", requireRole("owner", "admin"), async (req, res) => {
  const { name, location, streamUrl, sampleIntervalSec, isActive } = req.body as {
    name?: string; location?: string; streamUrl?: string; sampleIntervalSec?: number; isActive?: boolean;
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) {
    if (!name.trim()) { res.status(400).json({ error: "name cannot be empty" }); return; }
    updates.name = name.trim();
  }
  if (location !== undefined) updates.location = location?.trim() || null;
  if (streamUrl !== undefined) {
    if (streamUrl.includes(MASKED_CREDENTIALS)) {
      res.status(400).json({ error: "streamUrl contains a masked credential placeholder; re-enter the full URL" });
      return;
    }
    const urlError = validateStreamUrl(streamUrl.trim());
    if (urlError) { res.status(400).json({ error: urlError }); return; }
    updates.streamUrl = streamUrl.trim();
    updates.status = "offline";
    updates.lastError = null;
  }
  if (sampleIntervalSec !== undefined) updates.sampleIntervalSec = Math.max(2, Math.min(3600, Math.round(sampleIntervalSec)));
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const [updated] = await db
    .update(watchCamerasTable)
    .set(updates)
    .where(and(eq(watchCamerasTable.id, req.params.id as string), eq(watchCamerasTable.orgId, req.thea!.org.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Camera not found" }); return; }
  res.json(updated);
});

router.delete("/cameras/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(watchCamerasTable)
    .where(and(eq(watchCamerasTable.id, req.params.id as string), eq(watchCamerasTable.orgId, req.thea!.org.id)))
    .returning({ id: watchCamerasTable.id });
  if (!deleted) { res.status(404).json({ error: "Camera not found" }); return; }
  res.json({ ok: true });
});

// ═══ DVR / NVR integration ════════════════════════════════════════════════════

const DVR_IMPORT_MAX_CHANNELS = 32;

interface DvrRequestBody {
  brand?: string; host?: string; port?: number; username?: string; password?: string;
  quality?: string; urlPattern?: string;
}

/** Probe a single DVR channel by grabbing one frame — validates host/creds/template. */
router.post("/dvr/test", requireRole("owner", "admin"), async (req, res) => {
  const { brand, host, port, username, password, quality, urlPattern, channel } = req.body as DvrRequestBody & { channel?: number };
  if (!isDvrBrand(brand)) { res.status(400).json({ error: "brand must be one of hikvision, dahua, amcrest, uniview, reolink, generic" }); return; }
  if (!(await probeFfmpeg())) { res.status(503).json({ error: "ffmpeg is not available on the server" }); return; }
  const q: DvrStreamQuality = quality === "main" ? "main" : "sub";
  let url: string;
  try {
    url = buildDvrChannelUrl({ brand, host: host ?? "", port, username, password, channel: channel ?? 1, quality: q, urlPattern });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid DVR settings" });
    return;
  }
  try {
    await captureFrame(url, 15000);
    res.json({ ok: true, url: maskStreamUrl(url) });
  } catch (err) {
    const message = redactStreamCredentials(err instanceof Error ? err.message : String(err));
    res.json({ ok: false, error: message.slice(0, 300), url: maskStreamUrl(url) });
  }
});

/** Bulk-import DVR channels as individual cameras (sub-stream recommended). */
router.post("/dvr/import", requireRole("owner", "admin"), async (req, res) => {
  const { brand, host, port, username, password, quality, urlPattern, channels, namePrefix, location, sampleIntervalSec } =
    req.body as DvrRequestBody & { channels?: number[]; namePrefix?: string; location?: string; sampleIntervalSec?: number };
  if (!isDvrBrand(brand)) { res.status(400).json({ error: "brand must be one of hikvision, dahua, amcrest, uniview, reolink, generic" }); return; }
  if (!Array.isArray(channels) || channels.length === 0) { res.status(400).json({ error: "channels is required (e.g. [1,2,3,4])" }); return; }
  const chans = [...new Set(channels.map((c) => Number(c)))].filter((c) => Number.isInteger(c)).sort((a, b) => a - b);
  if (chans.length === 0) { res.status(400).json({ error: "channels must contain integer channel numbers" }); return; }
  if (chans.length > DVR_IMPORT_MAX_CHANNELS) { res.status(400).json({ error: `At most ${DVR_IMPORT_MAX_CHANNELS} channels per import` }); return; }
  const q: DvrStreamQuality = quality === "main" ? "main" : "sub";
  const interval = Math.max(2, Math.min(3600, Math.round(sampleIntervalSec ?? 3)));
  const prefix = namePrefix?.trim() || host?.trim() || "DVR";

  let rows: (typeof watchCamerasTable.$inferInsert)[];
  try {
    rows = chans.map((channel) => {
      const url = buildDvrChannelUrl({ brand, host: host ?? "", port, username, password, channel, quality: q, urlPattern });
      const dvrHost = brand === "generic" ? new URL(url).host : `${host?.trim()}:${port ?? 554}`;
      return {
        orgId: req.thea!.org.id,
        name: `${prefix} — Channel ${channel}`,
        location: location?.trim() || null,
        streamUrl: url,
        sourceType: "dvr" as const,
        dvrBrand: brand,
        dvrHost,
        dvrChannel: channel,
        sampleIntervalSec: interval,
        isActive: true,
      };
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid DVR settings" });
    return;
  }

  const created = await db.insert(watchCamerasTable).values(rows).returning();
  logger.info({ orgId: req.thea!.org.id, brand, count: created.length }, "DVR channels imported as cameras");
  res.status(201).json({ data: created, total: created.length });
});

// ═══ Live streaming (on-demand HLS) ═══════════════════════════════════════════

const SEGMENT_NAME_RE = /^[A-Za-z0-9_-]+\.(m3u8|ts|m4s|mp4)$/;

/**
 * Starts (or polls) the live HLS session for a camera. Idempotent — clients
 * poll this until status is "live", then attach hls.js to playlistUrl.
 */
router.post("/cameras/:id/stream/start", async (req, res) => {
  const [camera] = await db
    .select()
    .from(watchCamerasTable)
    .where(and(eq(watchCamerasTable.id, req.params.id as string), eq(watchCamerasTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!camera) { res.status(404).json({ error: "Camera not found" }); return; }
  if (!(await probeFfmpeg())) { res.status(503).json({ error: "ffmpeg is not available on the server" }); return; }
  try {
    const result = await startLiveStream({ id: camera.id, orgId: camera.orgId, streamUrl: camera.streamUrl });
    if (result.status === "error") {
      res.status(502).json({ error: result.error || "Could not connect to the camera stream" });
      return;
    }
    res.json({
      status: result.status,
      transcoding: result.transcoding,
      playlistUrl: `/api/v1/watch/cameras/${camera.id}/stream/index.m3u8`,
    });
  } catch (err) {
    if (err instanceof LiveStreamCapacityError) { res.status(429).json({ error: err.message }); return; }
    throw err;
  }
});

/**
 * Serves the HLS playlist and segments for an active session. Org check is
 * against the in-memory session (no DB hit per segment); these paths are
 * exempted from the default rate limiter (one viewer ≈ 1 req/s).
 */
router.get("/cameras/:id/stream/:file", (req, res) => {
  const file = req.params.file as string;
  if (!SEGMENT_NAME_RE.test(file)) { res.status(400).json({ error: "Invalid stream file name" }); return; }
  const session = touchLiveStream(req.params.id as string, req.thea!.org.id);
  if (!session) { res.status(404).json({ error: "No live stream for this camera — start one first" }); return; }
  const filePath = join(session.dir, file);
  if (!existsSync(filePath)) { res.status(404).json({ error: "Stream file not found" }); return; }
  res.setHeader("Cache-Control", "no-store");
  res.type(file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t");
  res.sendFile(filePath);
});

/** Best-effort stop — the idle reaper is the authoritative teardown. */
router.post("/cameras/:id/stream/stop", (req, res) => {
  stopLiveStream(req.params.id as string, req.thea!.org.id);
  res.json({ ok: true });
});

// ═══ Watch targets ═══════════════════════════════════════════════════════════

interface ProcessedImage {
  imagePath: string;
  faceEmbedding: number[] | null;
  objectEmbedding: number[] | null;
  detectedClass: string | null;
  warning?: string;
}

/** Extract face descriptor or object embedding from a reference image per target type. */
async function processRefImage(orgId: string, type: string, jpegBuffer: Buffer): Promise<ProcessedImage> {
  const imagePath = await saveRefImage(orgId, jpegBuffer);
  if (type === "person") {
    const result = await computeDescriptor(jpegBuffer);
    if (!result) return { imagePath, faceEmbedding: null, objectEmbedding: null, detectedClass: null, warning: "No face detected in this photo" };
    return { imagePath, faceEmbedding: result.descriptor, objectEmbedding: null, detectedClass: null };
  }
  // vehicle / object: embed the most prominent relevant detection (or whole image)
  const rgb = decodeJpegToRgb(jpegBuffer);
  const detections = await detectObjects(rgb, 10);
  const relevant = detections
    .filter((d) => (type === "vehicle" ? VEHICLE_CLASSES.has(d.class) : d.class !== "person"))
    .sort((a, b) => b.score - a.score)[0];
  let source = rgb;
  let detectedClass: string | null = null;
  let warning: string | undefined;
  if (relevant) {
    const [x, y, w, h] = relevant.bbox;
    const crop = cropRgb(rgb, x - w * 0.05, y - h * 0.05, w * 1.1, h * 1.1);
    if (crop) source = crop;
    detectedClass = relevant.class;
  } else {
    warning = type === "vehicle" ? "No vehicle detected — using whole image" : "No object detected — using whole image";
  }
  const embedding = await computeObjectEmbedding(source);
  return { imagePath, faceEmbedding: null, objectEmbedding: embedding, detectedClass, warning };
}

router.get("/targets", async (req, res) => {
  const rows = await db
    .select({ target: watchTargetsTable, imageCount: count(watchTargetImagesTable.id) })
    .from(watchTargetsTable)
    .leftJoin(watchTargetImagesTable, eq(watchTargetImagesTable.targetId, watchTargetsTable.id))
    .where(eq(watchTargetsTable.orgId, req.thea!.org.id))
    .groupBy(watchTargetsTable.id)
    .orderBy(desc(watchTargetsTable.createdAt));
  res.json({ data: rows.map((r) => ({ ...r.target, imageCount: Number(r.imageCount) })), total: rows.length });
});

router.get("/targets/:id", async (req, res) => {
  const [target] = await db
    .select()
    .from(watchTargetsTable)
    .where(and(eq(watchTargetsTable.id, req.params.id as string), eq(watchTargetsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!target) { res.status(404).json({ error: "Target not found" }); return; }
  const images = await db
    .select({
      id: watchTargetImagesTable.id,
      detectedClass: watchTargetImagesTable.detectedClass,
      hasFace: watchTargetImagesTable.faceEmbedding,
      createdAt: watchTargetImagesTable.createdAt,
    })
    .from(watchTargetImagesTable)
    .where(eq(watchTargetImagesTable.targetId, target.id))
    .orderBy(desc(watchTargetImagesTable.createdAt));
  res.json({
    ...target,
    images: images.map((i) => ({ id: i.id, detectedClass: i.detectedClass, hasFace: i.hasFace != null, createdAt: i.createdAt })),
  });
});

router.post("/targets", requireRole("owner", "admin"), async (req, res) => {
  const { name, type, plateText, notes, minConfidence, cooldownSec, alertChannels, images } = req.body as {
    name?: string; type?: string; plateText?: string; notes?: string;
    minConfidence?: number; cooldownSec?: number; alertChannels?: unknown; images?: string[];
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!type || !TARGET_TYPES.has(type)) { res.status(400).json({ error: "type must be person, vehicle, object or plate" }); return; }

  let normalizedPlate: string | null = null;
  if (type === "plate") {
    normalizedPlate = normalizePlate(plateText ?? "");
    if (normalizedPlate.length < 4 || normalizedPlate.length > 10) {
      res.status(400).json({ error: "plateText must contain 4-10 letters/digits" });
      return;
    }
  } else if (type === "person" || type === "object") {
    if (!Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: `At least one reference image is required for ${type} targets` });
      return;
    }
  }

  const imageList = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES_PER_TARGET);
  const processed: ProcessedImage[] = [];
  const warnings: string[] = [];
  for (const [idx, img] of imageList.entries()) {
    try {
      const result = await processRefImage(req.thea!.org.id, type, decodeBase64Jpeg(img));
      if (result.warning) warnings.push(`Image ${idx + 1}: ${result.warning}`);
      processed.push(result);
    } catch (err) {
      logger.warn({ err }, "Reference image processing failed");
      warnings.push(`Image ${idx + 1}: could not be processed (JPEG required)`);
    }
  }

  const usable = processed.filter((p) => p.faceEmbedding || p.objectEmbedding);
  if (type === "person" && usable.length === 0) {
    res.status(400).json({ error: "No face could be detected in the provided photos", warnings });
    return;
  }
  if ((type === "vehicle" || type === "object") && imageList.length > 0 && usable.length === 0) {
    res.status(400).json({ error: "None of the reference images could be processed", warnings });
    return;
  }

  const [target] = await db
    .insert(watchTargetsTable)
    .values({
      orgId: req.thea!.org.id,
      name: name.trim(),
      type,
      plateText: normalizedPlate,
      notes: notes?.trim() || null,
      minConfidence: minConfidence != null ? Math.max(0.1, Math.min(1, minConfidence)) : null,
      cooldownSec: Math.max(10, Math.min(86400, Math.round(cooldownSec ?? 300))),
      alertChannels: sanitizeAlertChannels(alertChannels),
    })
    .returning();

  if (usable.length > 0) {
    await db.insert(watchTargetImagesTable).values(
      usable.map((p) => ({
        orgId: req.thea!.org.id,
        targetId: target!.id,
        imagePath: p.imagePath,
        faceEmbedding: p.faceEmbedding,
        objectEmbedding: p.objectEmbedding,
        detectedClass: p.detectedClass,
      })),
    );
  }

  res.status(201).json({ ...target, imageCount: usable.length, warnings });
});

router.patch("/targets/:id", requireRole("owner", "admin"), async (req, res) => {
  const { name, plateText, notes, minConfidence, cooldownSec, alertChannels, isActive } = req.body as {
    name?: string; plateText?: string; notes?: string;
    minConfidence?: number | null; cooldownSec?: number; alertChannels?: unknown; isActive?: boolean;
  };
  const [existing] = await db
    .select()
    .from(watchTargetsTable)
    .where(and(eq(watchTargetsTable.id, req.params.id as string), eq(watchTargetsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Target not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) {
    if (!name.trim()) { res.status(400).json({ error: "name cannot be empty" }); return; }
    updates.name = name.trim();
  }
  if (plateText !== undefined && existing.type === "plate") {
    const normalized = normalizePlate(plateText);
    if (normalized.length < 4 || normalized.length > 10) {
      res.status(400).json({ error: "plateText must contain 4-10 letters/digits" });
      return;
    }
    updates.plateText = normalized;
  }
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (minConfidence !== undefined) updates.minConfidence = minConfidence != null ? Math.max(0.1, Math.min(1, minConfidence)) : null;
  if (cooldownSec !== undefined) updates.cooldownSec = Math.max(10, Math.min(86400, Math.round(cooldownSec)));
  if (alertChannels !== undefined) updates.alertChannels = sanitizeAlertChannels(alertChannels);
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const [updated] = await db
    .update(watchTargetsTable)
    .set(updates)
    .where(eq(watchTargetsTable.id, existing.id))
    .returning();
  res.json(updated);
});

router.delete("/targets/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(watchTargetsTable)
    .where(and(eq(watchTargetsTable.id, req.params.id as string), eq(watchTargetsTable.orgId, req.thea!.org.id)))
    .returning({ id: watchTargetsTable.id });
  if (!deleted) { res.status(404).json({ error: "Target not found" }); return; }
  res.json({ ok: true });
});

router.post("/targets/:id/images", requireRole("owner", "admin"), async (req, res) => {
  const { images } = req.body as { images?: string[] };
  if (!Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: "images array is required" });
    return;
  }
  const [target] = await db
    .select()
    .from(watchTargetsTable)
    .where(and(eq(watchTargetsTable.id, req.params.id as string), eq(watchTargetsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!target) { res.status(404).json({ error: "Target not found" }); return; }
  if (target.type === "plate") { res.status(400).json({ error: "Plate targets are matched by text, not images" }); return; }

  const [{ existingCount }] = await db
    .select({ existingCount: count(watchTargetImagesTable.id) })
    .from(watchTargetImagesTable)
    .where(eq(watchTargetImagesTable.targetId, target.id));
  const room = MAX_IMAGES_PER_TARGET - Number(existingCount);
  if (room <= 0) { res.status(400).json({ error: `Maximum of ${MAX_IMAGES_PER_TARGET} reference images per target` }); return; }

  const warnings: string[] = [];
  const rows: Array<{ orgId: string; targetId: string; imagePath: string; faceEmbedding: number[] | null; objectEmbedding: number[] | null; detectedClass: string | null }> = [];
  for (const [idx, img] of images.slice(0, room).entries()) {
    try {
      const result = await processRefImage(req.thea!.org.id, target.type, decodeBase64Jpeg(img));
      if (result.warning) warnings.push(`Image ${idx + 1}: ${result.warning}`);
      if (result.faceEmbedding || result.objectEmbedding) {
        rows.push({
          orgId: req.thea!.org.id,
          targetId: target.id,
          imagePath: result.imagePath,
          faceEmbedding: result.faceEmbedding,
          objectEmbedding: result.objectEmbedding,
          detectedClass: result.detectedClass,
        });
      }
    } catch (err) {
      logger.warn({ err }, "Reference image processing failed");
      warnings.push(`Image ${idx + 1}: could not be processed (JPEG required)`);
    }
  }
  if (rows.length === 0) { res.status(400).json({ error: "No usable reference images", warnings }); return; }
  const inserted = await db.insert(watchTargetImagesTable).values(rows).returning({ id: watchTargetImagesTable.id });
  res.status(201).json({ added: inserted.length, warnings });
});

router.delete("/targets/:id/images/:imageId", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(watchTargetImagesTable)
    .where(and(
      eq(watchTargetImagesTable.id, req.params.imageId as string),
      eq(watchTargetImagesTable.targetId, req.params.id as string),
      eq(watchTargetImagesTable.orgId, req.thea!.org.id),
    ))
    .returning({ id: watchTargetImagesTable.id });
  if (!deleted) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ ok: true });
});

// ═══ Sightings ═══════════════════════════════════════════════════════════════

router.get("/sightings", async (req, res) => {
  const { targetId, cameraId, videoJobId } = req.query as Record<string, string | undefined>;
  const limit = Math.max(1, Math.min(200, parseInt((req.query.limit as string) ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt((req.query.offset as string) ?? "0", 10) || 0);

  const conditions = [eq(watchSightingsTable.orgId, req.thea!.org.id)];
  if (targetId) conditions.push(eq(watchSightingsTable.targetId, targetId));
  if (cameraId) conditions.push(eq(watchSightingsTable.cameraId, cameraId));
  if (videoJobId) conditions.push(eq(watchSightingsTable.videoJobId, videoJobId));

  const [rows, [total]] = await Promise.all([
    db.select().from(watchSightingsTable).where(and(...conditions)).orderBy(desc(watchSightingsTable.createdAt)).limit(limit).offset(offset),
    db.select({ n: count(watchSightingsTable.id) }).from(watchSightingsTable).where(and(...conditions)),
  ]);

  // Attach display names without FK joins surviving deletes
  const targetIds = [...new Set(rows.map((r) => r.targetId).filter(Boolean))] as string[];
  const cameraIds = [...new Set(rows.map((r) => r.cameraId).filter(Boolean))] as string[];
  const [targets, cameras] = await Promise.all([
    targetIds.length ? db.select({ id: watchTargetsTable.id, name: watchTargetsTable.name, type: watchTargetsTable.type }).from(watchTargetsTable).where(inArray(watchTargetsTable.id, targetIds)) : Promise.resolve([]),
    cameraIds.length ? db.select({ id: watchCamerasTable.id, name: watchCamerasTable.name }).from(watchCamerasTable).where(inArray(watchCamerasTable.id, cameraIds)) : Promise.resolve([]),
  ]);
  const targetMap = new Map(targets.map((t) => [t.id, t]));
  const cameraMap = new Map(cameras.map((c) => [c.id, c]));

  res.json({
    data: rows.map((r) => ({
      ...r,
      targetName: r.targetId ? targetMap.get(r.targetId)?.name ?? null : null,
      targetType: r.targetId ? targetMap.get(r.targetId)?.type ?? null : null,
      cameraName: r.cameraId ? cameraMap.get(r.cameraId)?.name ?? null : null,
      hasSnapshot: r.snapshotPath != null,
    })),
    total: Number(total?.n ?? 0),
  });
});

router.get("/sightings/:id", async (req, res) => {
  const [row] = await db
    .select()
    .from(watchSightingsTable)
    .where(and(eq(watchSightingsTable.id, req.params.id as string), eq(watchSightingsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Sighting not found" }); return; }

  const [target] = row.targetId
    ? await db.select({ name: watchTargetsTable.name, type: watchTargetsTable.type }).from(watchTargetsTable).where(eq(watchTargetsTable.id, row.targetId)).limit(1)
    : [undefined];
  const [camera] = row.cameraId
    ? await db.select({ name: watchCamerasTable.name, location: watchCamerasTable.location }).from(watchCamerasTable).where(eq(watchCamerasTable.id, row.cameraId)).limit(1)
    : [undefined];

  res.json({
    ...row,
    targetName: target?.name ?? null,
    targetType: target?.type ?? null,
    cameraName: camera?.name ?? null,
    cameraLocation: camera?.location ?? null,
    hasSnapshot: row.snapshotPath != null,
  });
});

router.get("/sightings/:id/snapshot", async (req, res) => {
  const [sighting] = await db
    .select({ snapshotPath: watchSightingsTable.snapshotPath })
    .from(watchSightingsTable)
    .where(and(eq(watchSightingsTable.id, req.params.id as string), eq(watchSightingsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!sighting?.snapshotPath) { res.status(404).json({ error: "Snapshot not found" }); return; }
  const abs = resolveSnapshotPath(sighting.snapshotPath);
  if (!abs) { res.status(404).json({ error: "Snapshot not found" }); return; }
  res.sendFile(abs, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Snapshot file missing" });
  });
});

router.delete("/sightings/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(watchSightingsTable)
    .where(and(eq(watchSightingsTable.id, req.params.id as string), eq(watchSightingsTable.orgId, req.thea!.org.id)))
    .returning({ id: watchSightingsTable.id });
  if (!deleted) { res.status(404).json({ error: "Sighting not found" }); return; }
  res.json({ ok: true });
});

// ═══ Offline video scans ═════════════════════════════════════════════════════

router.get("/videos", async (req, res) => {
  const jobs = await db
    .select()
    .from(watchVideoJobsTable)
    .where(eq(watchVideoJobsTable.orgId, req.thea!.org.id))
    .orderBy(desc(watchVideoJobsTable.createdAt))
    .limit(50);
  res.json({ data: jobs.map(({ filePath: _fp, ...rest }) => rest), total: jobs.length });
});

router.get("/videos/:id", async (req, res) => {
  const [job] = await db
    .select()
    .from(watchVideoJobsTable)
    .where(and(eq(watchVideoJobsTable.id, req.params.id as string), eq(watchVideoJobsTable.orgId, req.thea!.org.id)))
    .limit(1);
  if (!job) { res.status(404).json({ error: "Video job not found" }); return; }
  const { filePath: _fp, ...rest } = job;
  res.json(rest);
});

router.post("/videos", requireRole("owner", "admin"), async (req, res) => {
  if (!(await probeFfmpeg())) {
    res.status(503).json({ error: "Video scanning is unavailable — ffmpeg is not installed on this server" });
    return;
  }
  if (!existsSync(VIDEO_TMP_DIR)) mkdirSync(VIDEO_TMP_DIR, { recursive: true });

  let bb: busboy.Busboy;
  try {
    bb = busboy({ headers: req.headers, limits: { fileSize: MAX_VIDEO_BYTES, files: 1 } });
  } catch {
    res.status(400).json({ error: "Expected multipart/form-data upload" });
    return;
  }

  let handled = false;
  let sawFile = false;

  bb.on("file", (_field, stream, info) => {
    sawFile = true;
    const ext = (extname(info.filename ?? "").toLowerCase() || ".mp4").slice(0, 8);
    const filePath = join(VIDEO_TMP_DIR, `${randomUUID()}${ext}`);
    const out = createWriteStream(filePath);
    let truncated = false;

    stream.on("limit", () => {
      truncated = true;
      stream.unpipe(out);
      out.destroy();
      void unlink(filePath).catch(() => undefined);
      if (!handled) {
        handled = true;
        res.status(413).json({ error: "Video exceeds the 500MB limit" });
      }
      stream.resume();
    });

    stream.pipe(out);
    out.on("error", () => {
      void unlink(filePath).catch(() => undefined);
      if (!handled) {
        handled = true;
        res.status(500).json({ error: "Failed to store the uploaded file" });
      }
    });
    // Client aborted mid-upload: nothing else will fire reliably, so clean up here.
    req.on("close", () => {
      if (!req.readableEnded && !handled) {
        handled = true;
        out.destroy();
        void unlink(filePath).catch(() => undefined);
      }
    });
    out.on("finish", () => {
      if (truncated || handled) return;
      void (async () => {
        try {
          const [job] = await db
            .insert(watchVideoJobsTable)
            .values({
              orgId: req.thea!.org.id,
              fileName: (info.filename ?? "upload.mp4").slice(0, 255),
              filePath,
            })
            .returning();
          await addJob("videoScan", "scan", { videoJobId: job!.id });
          handled = true;
          const { filePath: _fp, ...rest } = job!;
          res.status(201).json(rest);
        } catch (err) {
          logger.error({ err }, "Video job creation failed");
          await unlink(filePath).catch(() => undefined);
          if (!handled) {
            handled = true;
            res.status(500).json({ error: "Failed to create the scan job" });
          }
        }
      })();
    });
  });

  bb.on("close", () => {
    if (!sawFile && !handled) {
      handled = true;
      res.status(400).json({ error: "No video file in the upload" });
    }
  });
  bb.on("error", () => {
    if (!handled) {
      handled = true;
      res.status(400).json({ error: "Malformed upload" });
    }
  });

  req.pipe(bb);
});

export default router;
