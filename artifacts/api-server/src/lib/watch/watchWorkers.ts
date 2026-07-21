/**
 * BullMQ workers for Security Watch:
 * - visual-recognition: one live-camera frame per job (frame file in /tmp).
 * - video-scan: offline scan of an uploaded recording (frames at 1 per 2s).
 * Both run at concurrency 1 — inference is CPU-bound and serialized anyway.
 */
import { readFile, unlink, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db } from "@workspace/db";
import { watchVideoJobsTable } from "@workspace/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { createWorker } from "../queues";
import { logger } from "../logger";
import { processFrame } from "./frameProcessor";
import { ffprobeDuration, extractFrames } from "./ffmpeg";

const VIDEO_FRAME_INTERVAL_SEC = 2;

/** Uploaded recordings land here until the scan worker consumes them. */
export const VIDEO_TMP_DIR = "/tmp/thea-watch-videos";

/**
 * Delete orphaned uploads (client aborted mid-upload, crashed before the job
 * row was created, etc.) older than 6 hours. Files still referenced by a
 * pending/processing job (filePath non-null) are always kept.
 */
async function cleanupOrphanVideos(): Promise<void> {
  try {
    const files = await readdir(VIDEO_TMP_DIR).catch(() => [] as string[]);
    if (files.length === 0) return;
    const referenced = new Set(
      (
        await db
          .select({ filePath: watchVideoJobsTable.filePath })
          .from(watchVideoJobsTable)
          .where(isNotNull(watchVideoJobsTable.filePath))
      ).map((r) => r.filePath as string)
    );
    const cutoff = Date.now() - 6 * 60 * 60_000;
    for (const f of files) {
      const p = join(VIDEO_TMP_DIR, f);
      if (referenced.has(p)) continue;
      const s = await stat(p).catch(() => null);
      if (s && s.mtimeMs < cutoff) await unlink(p).catch(() => undefined);
    }
  } catch (err) {
    logger.warn({ err }, "Orphan video sweep failed");
  }
}

interface CameraFrameJob {
  orgId: string;
  cameraId: string;
  framePath: string;
}

export function startVisualRecognitionWorker(): void {
  createWorker<CameraFrameJob>("visual-recognition", async (job) => {
    const { orgId, cameraId, framePath } = job.data;
    let frame: Buffer;
    try {
      frame = await readFile(framePath);
    } catch {
      return; // frame already cleaned up — stale job, drop silently
    }
    try {
      await processFrame(frame, { orgId, cameraId });
    } finally {
      await unlink(framePath).catch(() => undefined);
    }
  });
  logger.info("Visual recognition worker started");
}

interface VideoScanJob {
  videoJobId: string;
}

async function runVideoScan(videoJobId: string): Promise<void> {
  const [job] = await db.select().from(watchVideoJobsTable).where(eq(watchVideoJobsTable.id, videoJobId)).limit(1);
  if (!job) return;
  if (!job.filePath) {
    await db.update(watchVideoJobsTable).set({ status: "failed", error: "Uploaded file missing" }).where(eq(watchVideoJobsTable.id, videoJobId));
    return;
  }

  await db
    .update(watchVideoJobsTable)
    .set({ status: "processing", startedAt: new Date(), error: null })
    .where(eq(watchVideoJobsTable.id, videoJobId));

  let frameDir: string | null = null;
  try {
    const duration = await ffprobeDuration(job.filePath);
    if (duration != null) {
      await db.update(watchVideoJobsTable).set({ durationSec: duration }).where(eq(watchVideoJobsTable.id, videoJobId));
    }

    frameDir = await mkdtemp(join(tmpdir(), "thea-video-scan-"));
    await extractFrames(job.filePath, frameDir, VIDEO_FRAME_INTERVAL_SEC, duration);

    const frames = (await readdir(frameDir)).filter((f) => f.endsWith(".jpg")).sort();
    if (frames.length === 0) throw new Error("No frames could be extracted from the video");

    let framesScanned = 0;
    let sightingsCount = 0;
    for (const [idx, file] of frames.entries()) {
      const buffer = await readFile(join(frameDir, file));
      const offset = idx * VIDEO_FRAME_INTERVAL_SEC;
      const sightings = await processFrame(buffer, { orgId: job.orgId, videoJobId, videoOffsetSec: offset });
      sightingsCount += sightings.length;
      framesScanned += 1;
      if (framesScanned % 5 === 0 || framesScanned === frames.length) {
        await db
          .update(watchVideoJobsTable)
          .set({ framesScanned, sightingsCount, progress: framesScanned / frames.length })
          .where(eq(watchVideoJobsTable.id, videoJobId));
      }
    }

    await db
      .update(watchVideoJobsTable)
      .set({ status: "completed", progress: 1, framesScanned, sightingsCount, completedAt: new Date() })
      .where(eq(watchVideoJobsTable.id, videoJobId));
    logger.info({ videoJobId, framesScanned, sightingsCount }, "Video scan completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(watchVideoJobsTable)
      .set({ status: "failed", error: message.slice(0, 1000), completedAt: new Date() })
      .where(eq(watchVideoJobsTable.id, videoJobId));
    logger.warn({ err, videoJobId }, "Video scan failed");
  } finally {
    if (frameDir) await rm(frameDir, { recursive: true, force: true }).catch(() => undefined);
    // The uploaded file is single-use: remove it regardless of outcome.
    await unlink(job.filePath).catch(() => undefined);
    await db.update(watchVideoJobsTable).set({ filePath: null }).where(eq(watchVideoJobsTable.id, videoJobId)).catch(() => undefined);
  }
}

export function startVideoScanWorker(): void {
  createWorker<VideoScanJob>("video-scan", async (job) => {
    await runVideoScan(job.data.videoJobId);
  });
  setInterval(() => {
    void cleanupOrphanVideos();
  }, 60 * 60_000).unref();
  logger.info("Video scan worker started");
}
