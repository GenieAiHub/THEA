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
import { getRedis } from "../redis";
import { probeFfmpeg, captureFrame } from "./ffmpeg";

export const FRAME_TMP_DIR = "/tmp/thea-watch-frames";

const REFRESH_INTERVAL_MS = 15_000;
const MIN_SAMPLE_INTERVAL_SEC = 2;
const DEFAULT_BACKPRESSURE_LIMIT = 12;

// Distributed leader lock so only ONE API replica samples cameras.
// TTL must comfortably exceed the renew interval so brief Redis hiccups or
// event-loop stalls don't cause spurious leader churn.
const LEADER_KEY = "thea:watch:camera-sampler:leader";
const LEADER_TTL_MS = 30_000;
const LEADER_RENEW_INTERVAL_MS = 10_000;
const INSTANCE_ID = randomUUID();

// Atomically renew the lock only if we still hold it.
const RENEW_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
// Atomically release the lock only if we still hold it.
const RELEASE_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

interface CameraRunner {
  camera: WatchCamera;
  timer: NodeJS.Timeout;
  inFlight: boolean;
  consecutiveFailures: number;
}

const runners = new Map<string, CameraRunner>();
let refreshTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let leaderTimer: NodeJS.Timeout | null = null;
let samplerEnabled = false;
let isLeader = false;

export function isSamplerRunning(): boolean {
  return samplerEnabled;
}

export function isSamplerLeader(): boolean {
  return isLeader;
}

let lastSuccessfulLockAt = 0;

/** Minimal Redis surface the leader lock needs (overridable in tests). */
interface LockRedis {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  set(key: string, value: string, px: "PX", ms: number, nx: "NX"): Promise<string | null>;
}

let redisOverride: LockRedis | null = null;

function getLockRedis(): LockRedis {
  return redisOverride ?? (getRedis() as unknown as LockRedis);
}

/**
 * Try to become (or stay) the sampling leader. Returns whether this instance
 * currently holds the lock. FAILS CLOSED on Redis errors:
 * - A non-leader never assumes leadership without confirming via Redis.
 * - A current leader tolerates errors only while its last confirmed lock is
 *   still within the TTL (no other node can have acquired the key in that
 *   window if Redis is fully down); once the TTL has elapsed it stands down,
 *   since the key may have expired and been taken by another replica.
 */
async function tryAcquireOrRenewLeadership(): Promise<boolean> {
  // Once Redis positively confirms the lock is no longer ours (renew returned
  // 0), the TTL grace window must NOT apply: another replica may already hold
  // it. Only a successful SET NX may keep us leader from that point on.
  let lockKnownLost = false;
  try {
    const redis = getLockRedis();
    if (isLeader) {
      const renewed = await redis.eval(RENEW_LUA, 1, LEADER_KEY, INSTANCE_ID, String(LEADER_TTL_MS));
      if (renewed === 1) {
        lastSuccessfulLockAt = Date.now();
        return true;
      }
      // Redis confirmed the lock expired / was taken over; try a clean re-acquire.
      lockKnownLost = true;
    }
    const acquired = await redis.set(LEADER_KEY, INSTANCE_ID, "PX", LEADER_TTL_MS, "NX");
    if (acquired === "OK") {
      lastSuccessfulLockAt = Date.now();
      return true;
    }
    return false;
  } catch (err) {
    if (isLeader && !lockKnownLost && Date.now() - lastSuccessfulLockAt < LEADER_TTL_MS) {
      logger.warn({ err }, "Camera sampler leader lock renew errored; retaining leadership within TTL grace window");
      return true;
    }
    logger.warn({ err, lockKnownLost }, "Camera sampler leader lock check failed; failing closed (not leader)");
    return false;
  }
}

function becomeLeader(): void {
  if (isLeader) return;
  isLeader = true;
  logger.info({ instanceId: INSTANCE_ID }, "Camera sampler: this instance is now the leader");
  void refresh();
  refreshTimer = setInterval(() => {
    void refresh();
  }, REFRESH_INTERVAL_MS);
  cleanupTimer = setInterval(() => {
    void cleanupStaleFrames();
  }, 5 * 60_000);
}

function relinquishLeadership(): void {
  if (!isLeader) return;
  isLeader = false;
  logger.warn({ instanceId: INSTANCE_ID }, "Camera sampler: lost leadership; stopping local samplers");
  if (refreshTimer) clearInterval(refreshTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  refreshTimer = null;
  cleanupTimer = null;
  for (const id of [...runners.keys()]) stopRunner(id);
}

async function leaderTick(): Promise<void> {
  const holding = await tryAcquireOrRenewLeadership();
  if (holding && !isLeader) becomeLeader();
  else if (!holding && isLeader) relinquishLeadership();
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

  // Leader election: only the lock holder runs samplers. On a single instance
  // the lock is acquired immediately here, so behavior is unchanged.
  await leaderTick();
  leaderTimer = setInterval(() => {
    void leaderTick();
  }, LEADER_RENEW_INTERVAL_MS);
  logger.info(
    { leader: isLeader, instanceId: INSTANCE_ID },
    isLeader
      ? "Security Watch camera sampler running (leader)"
      : "Security Watch camera sampler on standby (another instance is leader)",
  );
}

export function stopCameraSampler(): void {
  if (leaderTimer) clearInterval(leaderTimer);
  leaderTimer = null;
  const wasLeader = isLeader;
  relinquishLeadership();
  samplerEnabled = false;
  if (wasLeader) {
    // Best-effort release so a replacement instance can take over immediately
    // instead of waiting out the TTL.
    try {
      void Promise.resolve(getLockRedis().eval(RELEASE_LUA, 1, LEADER_KEY, INSTANCE_ID)).catch(() => undefined);
    } catch {
      /* redis unavailable — lock will expire via TTL */
    }
  }
}

/** Test-only hooks — never use in production code paths. */
export const __leaderLockTesting = {
  tryAcquireOrRenewLeadership,
  setRedisOverride(r: LockRedis | null): void {
    redisOverride = r;
  },
  getState() {
    return { isLeader, lastSuccessfulLockAt };
  },
  setState(state: { isLeader?: boolean; lastSuccessfulLockAt?: number }): void {
    if (state.isLeader !== undefined) isLeader = state.isLeader;
    if (state.lastSuccessfulLockAt !== undefined) lastSuccessfulLockAt = state.lastSuccessfulLockAt;
  },
  constants: { LEADER_KEY, LEADER_TTL_MS, INSTANCE_ID },
};
