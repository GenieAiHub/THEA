/**
 * Live-camera frame sampler: an in-process interval manager (NOT BullMQ
 * repeatables — per-camera cadences are dynamic and cheap to reschedule).
 * Each tick grabs one frame via ffmpeg and enqueues it for recognition,
 * with backpressure so a slow CPU pipeline never builds an unbounded queue.
 */
import { mkdirSync, existsSync } from "node:fs";
import { writeFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { watchCamerasTable, watchTargetsTable, type WatchCamera } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "../logger";
import { getPlatformConfigBool, getPlatformConfigNumber } from "../platform-config";
import { addJob, getQueues } from "../queues";
import { probeFfmpeg, captureFrame } from "./ffmpeg";

export const FRAME_TMP_DIR = "/tmp/thea-watch-frames";

const REFRESH_INTERVAL_MS = 15_000;
const MIN_SAMPLE_INTERVAL_SEC = 2;
const DEFAULT_BACKPRESSURE_LIMIT = 12;

interface CameraRunner {
  camera: WatchCamera;
  timer: NodeJS.Timeout;
  inFlight: boolean;
  consecutiveFailures: number;
}

const runners = new Map<string, CameraRunner>();
let refreshTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let samplerEnabled = false;

export function isSamplerRunning(): boolean {
  return samplerEnabled;
}

async function updateCameraHealth(cameraId: string, status: string, lastError: string | null): Promise<void> {
  try {
    await db
      .update(watchCamerasTable)
      .set({ status, lastError, ...(status === "online" ? { lastSeenAt: new Date() } : {}), updatedAt: new Date() })
      .where(eq(watchCamerasTable.id, cameraId));
  } catch (err) {
    logger.warn({ err, cameraId }, "Camera health update failed");
  }
}

async function sampleTick(runner: CameraRunner): Promise<void> {
  if (runner.inFlight) return;
  runner.inFlight = true;
  try {
    // Backpressure: if recognition is behind, skip this tick rather than queueing stale frames.
    const waiting = await getQueues().visualRecognition.getWaitingCount();
    const limit = await getPlatformConfigNumber("watch_queue_backpressure", DEFAULT_BACKPRESSURE_LIMIT);
    if (waiting >= limit) return;

    const frame = await captureFrame(runner.camera.streamUrl);
    if (runner.camera.status !== "online" || runner.consecutiveFailures > 0) {
      runner.camera = { ...runner.camera, status: "online" };
      await updateCameraHealth(runner.camera.id, "online", null);
    } else {
      // Touch lastSeenAt at most every ~10 ticks to avoid a write per frame
      if (Math.random() < 0.1) await updateCameraHealth(runner.camera.id, "online", null);
    }
    runner.consecutiveFailures = 0;

    const framePath = join(FRAME_TMP_DIR, `${randomUUID()}.jpg`);
    await writeFile(framePath, frame);
    await addJob("visualRecognition", "camera-frame", {
      orgId: runner.camera.orgId,
      cameraId: runner.camera.id,
      framePath,
    });
  } catch (err) {
    runner.consecutiveFailures += 1;
    const message = err instanceof Error ? err.message : String(err);
    // Only write health on the transition to avoid a DB write per failed tick.
    if (runner.consecutiveFailures === 1 || runner.camera.status === "online") {
      runner.camera = { ...runner.camera, status: "error" };
      await updateCameraHealth(runner.camera.id, "error", message.slice(0, 500));
    }
    if (runner.consecutiveFailures <= 3) {
      logger.warn({ cameraId: runner.camera.id, err: message }, "Camera frame capture failed");
    }
  } finally {
    runner.inFlight = false;
  }
}

function startRunner(camera: WatchCamera): void {
  const intervalSec = Math.max(MIN_SAMPLE_INTERVAL_SEC, camera.sampleIntervalSec || 3);
  const runner: CameraRunner = { camera, timer: undefined as unknown as NodeJS.Timeout, inFlight: false, consecutiveFailures: 0 };
  runner.timer = setInterval(() => {
    void sampleTick(runner);
  }, intervalSec * 1000);
  runners.set(camera.id, runner);
  logger.info({ cameraId: camera.id, name: camera.name, intervalSec }, "Camera sampler started");
}

function stopRunner(cameraId: string): void {
  const runner = runners.get(cameraId);
  if (!runner) return;
  clearInterval(runner.timer);
  runners.delete(cameraId);
  logger.info({ cameraId }, "Camera sampler stopped");
}

/** Reconcile running samplers with the DB: active cameras whose org has >=1 active target. */
async function refresh(): Promise<void> {
  try {
    const cameras = await db.select().from(watchCamerasTable).where(eq(watchCamerasTable.isActive, true));
    let wanted: WatchCamera[] = [];
    if (cameras.length > 0) {
      const orgIds = [...new Set(cameras.map((c) => c.orgId))];
      const activeTargets = await db
        .select({ orgId: watchTargetsTable.orgId })
        .from(watchTargetsTable)
        .where(and(inArray(watchTargetsTable.orgId, orgIds), eq(watchTargetsTable.isActive, true)));
      const orgsWithTargets = new Set(activeTargets.map((t) => t.orgId));
      wanted = cameras.filter((c) => orgsWithTargets.has(c.orgId));
    }

    const wantedIds = new Set(wanted.map((c) => c.id));
    for (const id of [...runners.keys()]) {
      if (!wantedIds.has(id)) stopRunner(id);
    }
    for (const camera of wanted) {
      const existing = runners.get(camera.id);
      if (!existing) {
        startRunner(camera);
      } else if (
        existing.camera.streamUrl !== camera.streamUrl ||
        existing.camera.sampleIntervalSec !== camera.sampleIntervalSec
      ) {
        stopRunner(camera.id);
        startRunner(camera);
      } else {
        existing.camera = { ...camera, status: existing.camera.status };
      }
    }
  } catch (err) {
    logger.warn({ err }, "Camera sampler refresh failed");
  }
}

/** Delete orphaned frame files (worker crashes, dropped jobs) older than 10 minutes. */
async function cleanupStaleFrames(): Promise<void> {
  try {
    const files = await readdir(FRAME_TMP_DIR).catch(() => [] as string[]);
    const cutoff = Date.now() - 10 * 60_000;
    for (const f of files) {
      const p = join(FRAME_TMP_DIR, f);
      const s = await stat(p).catch(() => null);
      if (s && s.mtimeMs < cutoff) await unlink(p).catch(() => undefined);
    }
  } catch {
    /* best effort */
  }
}

export async function startCameraSampler(): Promise<void> {
  const enabled = await getPlatformConfigBool("security_watch_enabled", true);
  if (!enabled) {
    logger.info("Security Watch disabled by platform config (security_watch_enabled=false)");
    return;
  }
  const hasFfmpeg = await probeFfmpeg();
  if (!hasFfmpeg) return; // probeFfmpeg already logged

  if (!existsSync(FRAME_TMP_DIR)) mkdirSync(FRAME_TMP_DIR, { recursive: true });
  samplerEnabled = true;
  await refresh();
  refreshTimer = setInterval(() => {
    void refresh();
  }, REFRESH_INTERVAL_MS);
  cleanupTimer = setInterval(() => {
    void cleanupStaleFrames();
  }, 5 * 60_000);
  logger.info("Security Watch camera sampler running");
}

export function stopCameraSampler(): void {
  if (refreshTimer) clearInterval(refreshTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  refreshTimer = null;
  cleanupTimer = null;
  for (const id of [...runners.keys()]) stopRunner(id);
  samplerEnabled = false;
}
