/**
 * Core per-frame recognition: given a JPEG frame from a live camera or an
 * offline video, run only the pipelines the org's active watch targets need
 * (face matching, object detection + similarity, plate OCR), record sightings
 * with a snapshot, and fan out alerts for live-camera matches.
 */
import { db } from "@workspace/db";
import {
  watchTargetsTable,
  watchTargetImagesTable,
  watchSightingsTable,
  watchCamerasTable,
  type WatchTarget,
  type WatchSighting,
} from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "../logger";
import { computeAllDescriptors, faceDistance, FACE_MATCH_THRESHOLD } from "../faceRecognition";
import {
  detectObjects,
  computeObjectEmbedding,
  cosineSimilarity,
  VEHICLE_CLASSES,
  OBJECT_SIMILARITY_THRESHOLD,
  type ObjectDetection,
} from "./objectRecognition";
import { recognizePlateCandidates, platesMatch } from "./plateOcr";
import { decodeJpegToRgb, cropRgb, resizeRgb, grayscaleStretch, encodeRgbToJpeg, type RgbImage } from "./imageOps";
import { saveSnapshot } from "./snapshots";
import { maybeAlertSighting } from "./sightingAlerts";

export interface FrameContext {
  orgId: string;
  cameraId?: string;
  videoJobId?: string;
  videoOffsetSec?: number;
}

interface TargetWithRefs extends WatchTarget {
  refs: Array<{ faceEmbedding: number[] | null; objectEmbedding: number[] | null; detectedClass: string | null }>;
}

interface PendingMatch {
  target: TargetWithRefs;
  matchType: "face" | "object" | "plate";
  confidence: number;
  detail: string | null;
}

/** Default minimum detection score when a target doesn't override it. */
const DEFAULT_CLASS_MIN_SCORE = 0.6;

async function loadActiveTargets(orgId: string): Promise<TargetWithRefs[]> {
  const targets = await db
    .select()
    .from(watchTargetsTable)
    .where(and(eq(watchTargetsTable.orgId, orgId), eq(watchTargetsTable.isActive, true)));
  if (targets.length === 0) return [];

  const images = await db
    .select({
      targetId: watchTargetImagesTable.targetId,
      faceEmbedding: watchTargetImagesTable.faceEmbedding,
      objectEmbedding: watchTargetImagesTable.objectEmbedding,
      detectedClass: watchTargetImagesTable.detectedClass,
    })
    .from(watchTargetImagesTable)
    .where(inArray(watchTargetImagesTable.targetId, targets.map((t) => t.id)));

  const byTarget = new Map<string, TargetWithRefs["refs"]>();
  for (const img of images) {
    const list = byTarget.get(img.targetId) ?? [];
    list.push({ faceEmbedding: img.faceEmbedding, objectEmbedding: img.objectEmbedding, detectedClass: img.detectedClass });
    byTarget.set(img.targetId, list);
  }
  return targets.map((t) => ({ ...t, refs: byTarget.get(t.id) ?? [] }));
}

function matchFaces(descriptors: Array<{ descriptor: number[] }>, personTargets: TargetWithRefs[]): PendingMatch[] {
  const matches: PendingMatch[] = [];
  for (const target of personTargets) {
    let best = Infinity;
    for (const desc of descriptors) {
      for (const ref of target.refs) {
        if (!ref.faceEmbedding) continue;
        const d = faceDistance(desc.descriptor, ref.faceEmbedding);
        if (d < best) best = d;
      }
    }
    if (best <= FACE_MATCH_THRESHOLD) {
      matches.push({
        target,
        matchType: "face",
        confidence: Math.max(0, Math.min(1, 1 - best)),
        detail: `face distance ${best.toFixed(3)}`,
      });
    }
  }
  return matches;
}

function classMatchesTarget(target: TargetWithRefs, detClass: string): boolean {
  if (target.type === "vehicle") return VEHICLE_CLASSES.has(detClass);
  // object targets: match the class seen in their reference images (fallback: any non-person class)
  const refClasses = new Set(target.refs.map((r) => r.detectedClass).filter(Boolean) as string[]);
  if (refClasses.size > 0) return refClasses.has(detClass);
  return detClass !== "person";
}

async function matchObjects(
  frame: RgbImage,
  detections: ObjectDetection[],
  targets: TargetWithRefs[],
): Promise<PendingMatch[]> {
  const matches = new Map<string, PendingMatch>();
  for (const det of detections) {
    if (det.class === "person") continue;
    const candidates = targets.filter((t) => classMatchesTarget(t, det.class));
    if (candidates.length === 0) continue;

    // Compute the crop embedding once per detection, only if some candidate has reference embeddings.
    let cropEmbedding: number[] | null = null;
    const needsEmbedding = candidates.some((t) => t.refs.some((r) => r.objectEmbedding));
    if (needsEmbedding) {
      const [x, y, w, h] = det.bbox;
      const crop = cropRgb(frame, x - w * 0.05, y - h * 0.05, w * 1.1, h * 1.1);
      if (crop) cropEmbedding = await computeObjectEmbedding(crop);
    }

    for (const target of candidates) {
      const refEmbeddings = target.refs.map((r) => r.objectEmbedding).filter(Boolean) as number[][];
      let confidence: number | null = null;
      let detail: string | null = null;

      if (refEmbeddings.length > 0 && cropEmbedding) {
        let bestSim = 0;
        for (const ref of refEmbeddings) {
          const sim = cosineSimilarity(cropEmbedding, ref);
          if (sim > bestSim) bestSim = sim;
        }
        const threshold = target.minConfidence ?? OBJECT_SIMILARITY_THRESHOLD;
        if (bestSim >= threshold) {
          confidence = bestSim;
          detail = `${det.class} similarity ${bestSim.toFixed(2)}`;
        }
      } else if (refEmbeddings.length === 0) {
        // Class-only matching (e.g. "any truck")
        const threshold = target.minConfidence ?? DEFAULT_CLASS_MIN_SCORE;
        if (det.score >= threshold) {
          confidence = det.score;
          detail = `${det.class} detected`;
        }
      }

      if (confidence != null) {
        const existing = matches.get(target.id);
        if (!existing || confidence > existing.confidence) {
          matches.set(target.id, { target, matchType: "object", confidence, detail });
        }
      }
    }
  }
  return [...matches.values()];
}

/**
 * OCR plate-text candidates from vehicle crops (plates live on vehicles);
 * falls back to the whole frame when no vehicles were detected (e.g. tight
 * camera angle on a gate). Deduplicated by text, best confidence wins.
 */
async function extractPlateCandidates(
  frame: RgbImage,
  detections: ObjectDetection[],
): Promise<Array<{ text: string; confidence: number }>> {
  const regions: RgbImage[] = [];
  for (const det of detections) {
    if (!VEHICLE_CLASSES.has(det.class)) continue;
    const [x, y, w, h] = det.bbox;
    const crop = cropRgb(frame, x, y, w, h);
    if (!crop) continue;
    regions.push(crop);
    // Plates sit on the lower half of a vehicle; a tighter band reads better.
    const band = cropRgb(crop, 0, Math.floor(crop.height / 2), crop.width, Math.ceil(crop.height / 2));
    if (band) regions.push(band);
  }
  if (regions.length === 0) regions.push(frame);

  const byText = new Map<string, { text: string; confidence: number }>();
  for (const region of regions.slice(0, 6)) {
    // OCR both the raw crop and an upscaled contrast-stretched variant; each
    // wins in different lighting, and candidates are cheap to union.
    const upscaled = resizeRgb(region, region.width * 2, region.height * 2);
    const variants = [encodeRgbToJpeg(region, 90), encodeRgbToJpeg(grayscaleStretch(upscaled), 90)];
    const candidates = (await Promise.all(variants.map((v) => recognizePlateCandidates(v)))).flat();
    for (const cand of candidates) {
      const existing = byText.get(cand.text);
      if (!existing || cand.confidence > existing.confidence) {
        byText.set(cand.text, { text: cand.text, confidence: cand.confidence });
      }
    }
  }
  return [...byText.values()].sort((a, b) => b.confidence - a.confidence);
}

async function matchPlates(
  frame: RgbImage,
  detections: ObjectDetection[],
  plateTargets: TargetWithRefs[],
): Promise<PendingMatch[]> {
  const matches = new Map<string, PendingMatch>();
  const candidates = await extractPlateCandidates(frame, detections);
  for (const cand of candidates) {
    for (const target of plateTargets) {
      if (!target.plateText) continue;
      if (platesMatch(cand.text, target.plateText)) {
        const confidence = Math.max(cand.confidence, 0.5);
        const existing = matches.get(target.id);
        if (!existing || confidence > existing.confidence) {
          matches.set(target.id, {
            target,
            matchType: "plate",
            confidence,
            detail: `plate ${cand.text}`,
          });
        }
      }
    }
  }
  return [...matches.values()];
}

export interface FrameAnalysis {
  /** All COCO-SSD detections (class, score, bbox [x,y,w,h] in source pixels). */
  objects: Array<{ class: string; score: number; box: [number, number, number, number] }>;
  /** All detected faces with their 128-d descriptors (for caller-side matching). */
  faces: Array<{ score: number; descriptor: number[] }>;
  /** OCR'd plate-text candidates (best-confidence first). */
  plates: Array<{ text: string; confidence: number }>;
  /** Active watch targets this frame matched. */
  targetMatches: Array<{
    targetId: string;
    name: string;
    type: string;
    matchType: "face" | "object" | "plate";
    confidence: number;
    detail: string | null;
  }>;
}

/**
 * Analyze one frame WITHOUT recording sightings or firing alerts: detect all
 * objects and faces, OCR plate candidates when a vehicle is present, and match
 * against the org's active watch targets. Used by the mobile "Recognize"
 * feature; face→member matching is done by the caller (access domain).
 */
export async function analyzeFrame(jpegBuffer: Buffer, orgId: string): Promise<FrameAnalysis> {
  const targets = await loadActiveTargets(orgId);
  const personTargets = targets.filter((t) => t.type === "person" && t.refs.some((r) => r.faceEmbedding));
  const objectTargets = targets.filter((t) => t.type === "vehicle" || t.type === "object");
  const plateTargets = targets.filter((t) => t.type === "plate" && t.plateText);

  const frame = decodeJpegToRgb(jpegBuffer);
  const [detections, descriptors] = await Promise.all([detectObjects(frame), computeAllDescriptors(jpegBuffer)]);

  // OCR is the slow pipeline — only run it when the picture plausibly has a
  // plate (a vehicle was detected) or the org actively watches plates.
  const hasVehicle = detections.some((d) => VEHICLE_CLASSES.has(d.class));
  const plates = hasVehicle || plateTargets.length > 0 ? await extractPlateCandidates(frame, detections) : [];

  const allMatches: PendingMatch[] = [];
  if (personTargets.length > 0 && descriptors.length > 0) {
    allMatches.push(...matchFaces(descriptors, personTargets));
  }
  if (objectTargets.length > 0 && detections.length > 0) {
    allMatches.push(...(await matchObjects(frame, detections, objectTargets)));
  }
  if (plateTargets.length > 0 && plates.length > 0) {
    for (const cand of plates) {
      for (const target of plateTargets) {
        if (!target.plateText || !platesMatch(cand.text, target.plateText)) continue;
        const confidence = Math.max(cand.confidence, 0.5);
        const existing = allMatches.find((m) => m.target.id === target.id && m.matchType === "plate");
        if (!existing) {
          allMatches.push({ target, matchType: "plate", confidence, detail: `plate ${cand.text}` });
        } else if (confidence > existing.confidence) {
          existing.confidence = confidence;
          existing.detail = `plate ${cand.text}`;
        }
      }
    }
  }

  return {
    objects: detections.map((d) => ({
      class: d.class,
      score: d.score,
      box: [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]],
    })),
    faces: descriptors.map((d) => ({ score: d.score, descriptor: d.descriptor })),
    plates: plates.slice(0, 5),
    targetMatches: allMatches.map((m) => ({
      targetId: m.target.id,
      name: m.target.name,
      type: m.target.type,
      matchType: m.matchType,
      confidence: m.confidence,
      detail: m.detail,
    })),
  };
}

/**
 * Run recognition on one frame. Returns the sightings created (one per matched
 * target, deduplicated to the best match). Alerts fire only for live cameras.
 */
export async function processFrame(jpegBuffer: Buffer, ctx: FrameContext): Promise<WatchSighting[]> {
  const targets = await loadActiveTargets(ctx.orgId);
  if (targets.length === 0) return [];

  const personTargets = targets.filter((t) => t.type === "person" && t.refs.some((r) => r.faceEmbedding));
  const objectTargets = targets.filter((t) => t.type === "vehicle" || t.type === "object");
  const plateTargets = targets.filter((t) => t.type === "plate" && t.plateText);

  const allMatches: PendingMatch[] = [];
  let frame: RgbImage | null = null;

  try {
    if (personTargets.length > 0) {
      const descriptors = await computeAllDescriptors(jpegBuffer);
      if (descriptors.length > 0) allMatches.push(...matchFaces(descriptors, personTargets));
    }

    if (objectTargets.length > 0 || plateTargets.length > 0) {
      frame = decodeJpegToRgb(jpegBuffer);
      const detections = await detectObjects(frame);
      if (objectTargets.length > 0 && detections.length > 0) {
        allMatches.push(...(await matchObjects(frame, detections, objectTargets)));
      }
      if (plateTargets.length > 0) {
        allMatches.push(...(await matchPlates(frame, detections, plateTargets)));
      }
    }
  } catch (err) {
    logger.warn({ err, orgId: ctx.orgId, cameraId: ctx.cameraId }, "Frame recognition failed");
    return [];
  }

  if (allMatches.length === 0) return [];

  // One snapshot per frame, shared by all sightings from it.
  let snapshotPath: string | null = null;
  try {
    snapshotPath = await saveSnapshot(ctx.orgId, jpegBuffer);
  } catch (err) {
    logger.warn({ err }, "Snapshot save failed — recording sighting without snapshot");
  }

  const inserted = await db
    .insert(watchSightingsTable)
    .values(
      allMatches.map((m) => ({
        orgId: ctx.orgId,
        targetId: m.target.id,
        cameraId: ctx.cameraId ?? null,
        videoJobId: ctx.videoJobId ?? null,
        matchType: m.matchType,
        detail: m.detail,
        confidence: m.confidence,
        snapshotPath,
        videoOffsetSec: ctx.videoOffsetSec ?? null,
      })),
    )
    .returning();

  // Alerts: live cameras only — offline scans report via the job summary UI.
  if (ctx.cameraId) {
    const [camera] = await db
      .select()
      .from(watchCamerasTable)
      .where(eq(watchCamerasTable.id, ctx.cameraId))
      .limit(1);
    for (const sighting of inserted) {
      const match = allMatches.find((m) => m.target.id === sighting.targetId);
      if (!match) continue;
      await maybeAlertSighting({ target: match.target, camera: camera ?? null, sighting });
    }
  }

  return inserted;
}
