/**
 * On-demand live HLS streaming for Security Watch cameras.
 *
 * One ffmpeg process per camera converts the RTSP/HTTP source into a rolling
 * HLS playlist under /tmp/thea-watch-live/<cameraId>/. Sessions start when a
 * viewer requests them and are torn down by the idle reaper once nobody has
 * fetched the playlist/segments for a while — the reaper is the authoritative
 * teardown (an explicit stop is best-effort only, since sessions are shared
 * between viewers of the same camera).
 *
 * H.264 sources are remuxed with `-c:v copy` (near-zero CPU); anything else is
 * transcoded to 720p H.264. Audio is dropped to avoid codec issues in hls.js.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../logger";
import { getPlatformConfigNumber } from "../platform-config";
import { redactStreamCredentials } from "./mask";

export const LIVE_TMP_DIR = "/tmp/thea-watch-live";

const IDLE_TIMEOUT_MS = 60_000;
const REAPER_INTERVAL_MS = 15_000;
const PLAYLIST_WAIT_MS = 10_000;
const PROBE_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_STREAMS = 4;

export type LiveStreamStatus = "starting" | "live" | "error";

interface StreamSession {
  cameraId: string;
  orgId: string;
  proc: ChildProcess;
  dir: string;
  status: LiveStreamStatus;
  lastError: string | null;
  transcoding: boolean;
  lastAccess: number;
  startedAt: number;
}

const sessions = new Map<string, StreamSession>();
/** In-flight startLiveStream calls, keyed by cameraId — set synchronously so concurrent starts share one spawn. */
const inFlightStarts = new Map<string, Promise<StartLiveStreamResult>>();
let reaperTimer: NodeJS.Timeout | null = null;

function ensureReaper(): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(() => {
    const now = Date.now();
    for (const session of [...sessions.values()]) {
      if (now - session.lastAccess > IDLE_TIMEOUT_MS) {
        logger.info({ cameraId: session.cameraId }, "Live stream idle — stopping");
        teardown(session);
      }
    }
    if (sessions.size === 0 && reaperTimer) {
      clearInterval(reaperTimer);
      reaperTimer = null;
    }
  }, REAPER_INTERVAL_MS);
}

function teardown(session: StreamSession): void {
  if (sessions.get(session.cameraId) === session) sessions.delete(session.cameraId);
  try {
    if (session.proc.exitCode === null && !session.proc.killed) session.proc.kill("SIGKILL");
  } catch {
    /* already gone */
  }
  try {
    rmSync(session.dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

/** Video codec of the first video stream, or null when unprobeable. */
function probeVideoCodec(streamUrl: string): Promise<string | null> {
  return new Promise((resolveP) => {
    const args = ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0"];
    if (streamUrl.startsWith("rtsp:") || streamUrl.startsWith("rtsps:")) args.push("-rtsp_transport", "tcp");
    args.push("-i", streamUrl);
    try {
      const p = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      const t = setTimeout(() => {
        p.kill("SIGKILL");
        resolveP(null);
      }, PROBE_TIMEOUT_MS);
      p.stdout.on("data", (c: Buffer) => {
        out += c.toString();
      });
      p.on("error", () => {
        clearTimeout(t);
        resolveP(null);
      });
      p.on("close", () => {
        clearTimeout(t);
        const codec = out.trim().split("\n")[0]?.trim();
        resolveP(codec || null);
      });
    } catch {
      resolveP(null);
    }
  });
}

function buildFfmpegArgs(streamUrl: string, dir: string, transcode: boolean): string[] {
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  if (streamUrl.startsWith("rtsp:") || streamUrl.startsWith("rtsps:")) {
    args.push("-rtsp_transport", "tcp");
  }
  args.push("-i", streamUrl, "-an");
  if (transcode) {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-vf", "scale=-2:min(720\\,ih)", "-g", "30", "-sc_threshold", "0");
  } else {
    args.push("-c:v", "copy");
  }
  args.push(
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "6",
    "-hls_flags", "delete_segments+independent_segments",
    "-hls_segment_filename", join(dir, "seg_%05d.ts"),
    join(dir, "index.m3u8"),
  );
  return args;
}

async function waitForPlaylist(dir: string, proc: ChildProcess, timeoutMs: number): Promise<boolean> {
  const playlist = join(dir, "index.m3u8");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) return false;
    if (existsSync(playlist)) {
      const content = await readFile(playlist, "utf8").catch(() => "");
      if (content.includes(".ts")) return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return existsSync(playlist);
}

export interface StartLiveStreamResult {
  status: LiveStreamStatus;
  transcoding: boolean;
  error?: string;
}

export class LiveStreamCapacityError extends Error {
  constructor(max: number) {
    super(`All ${max} live stream slots are in use — close another live view and try again`);
    this.name = "LiveStreamCapacityError";
  }
}

/**
 * Starts (or re-touches) the live HLS session for a camera. Idempotent: while
 * a session is starting/live, subsequent calls report its current status, so
 * clients can poll this until it reaches "live".
 */
export async function startLiveStream(camera: { id: string; orgId: string; streamUrl: string }): Promise<StartLiveStreamResult> {
  const existing = sessions.get(camera.id);
  if (existing) {
    existing.lastAccess = Date.now();
    if (existing.status !== "live") {
      const ready = await waitForPlaylist(existing.dir, existing.proc, 2_000);
      if (ready) existing.status = "live";
      else if (existing.proc.exitCode !== null) {
        teardown(existing);
        return { status: "error", transcoding: existing.transcoding, error: existing.lastError ?? "Stream process exited" };
      }
    }
    return { status: existing.status, transcoding: existing.transcoding };
  }

  // Synchronous in-flight guard: concurrent starts for the same camera share
  // one spawn instead of racing (the loser would leak an ffmpeg the reaper
  // can't see, and two writers would corrupt the playlist).
  const inFlight = inFlightStarts.get(camera.id);
  if (inFlight) return inFlight;

  const startPromise = doStartLiveStream(camera).finally(() => {
    inFlightStarts.delete(camera.id);
  });
  inFlightStarts.set(camera.id, startPromise);
  return startPromise;
}

async function doStartLiveStream(camera: { id: string; orgId: string; streamUrl: string }): Promise<StartLiveStreamResult> {
  const maxStreams = await getPlatformConfigNumber("watch_live_max_streams", DEFAULT_MAX_STREAMS);
  // Count in-flight starts (minus our own) so parallel starts of different
  // cameras can't blow past the cap during the probe window.
  const effectiveCount = sessions.size + Math.max(0, inFlightStarts.size - 1);
  if (effectiveCount >= Math.max(1, maxStreams)) throw new LiveStreamCapacityError(Math.max(1, maxStreams));

  const dir = join(LIVE_TMP_DIR, camera.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const codec = await probeVideoCodec(camera.streamUrl);
  const transcode = codec !== "h264";
  if (transcode) logger.info({ cameraId: camera.id, codec }, "Live stream will transcode to H.264");

  const proc = spawn("ffmpeg", buildFfmpegArgs(camera.streamUrl, dir, transcode), {
    stdio: ["ignore", "ignore", "pipe"],
  });
  const session: StreamSession = {
    cameraId: camera.id,
    orgId: camera.orgId,
    proc,
    dir,
    status: "starting",
    lastError: null,
    transcoding: transcode,
    lastAccess: Date.now(),
    startedAt: Date.now(),
  };
  let stderrTail = "";
  proc.stderr!.on("data", (c: Buffer) => {
    stderrTail = (stderrTail + c.toString()).slice(-2000);
  });
  proc.on("error", (err) => {
    session.lastError = redactStreamCredentials(err.message);
    teardown(session);
  });
  proc.on("exit", (code) => {
    // Mark dead so the next /start respawns instead of serving a stale playlist.
    // Redact credentials — ffmpeg stderr often echoes the full input URL.
    session.lastError = redactStreamCredentials(stderrTail.trim().split("\n").pop() || `ffmpeg exited with code ${code}`);
    if (sessions.get(camera.id) === session) {
      logger.warn({ cameraId: camera.id, code, err: session.lastError }, "Live stream ffmpeg exited");
      teardown(session);
    }
  });

  sessions.set(camera.id, session);
  ensureReaper();

  const ready = await waitForPlaylist(dir, proc, PLAYLIST_WAIT_MS);
  if (proc.exitCode !== null) {
    const error = session.lastError ?? "Could not connect to the camera stream";
    teardown(session);
    return { status: "error", transcoding: transcode, error };
  }
  session.status = ready ? "live" : "starting";
  session.lastAccess = Date.now();
  return { status: session.status, transcoding: transcode };
}

/**
 * Returns the session for playlist/segment serving iff it belongs to the org,
 * touching its idle timer. Org check is in-memory — no DB hit per segment.
 */
export function touchLiveStream(cameraId: string, orgId: string): { dir: string; status: LiveStreamStatus } | null {
  const session = sessions.get(cameraId);
  if (!session || session.orgId !== orgId) return null;
  session.lastAccess = Date.now();
  return { dir: session.dir, status: session.status };
}

/**
 * Best-effort stop — ages the session's idle timer so the reaper collects it
 * on its next pass unless another viewer touches it first. Sessions are shared
 * per camera, so an immediate teardown here would kill playback for other
 * viewers of the same camera; the idle reaper stays the authoritative teardown.
 */
export function stopLiveStream(cameraId: string, orgId: string): boolean {
  const session = sessions.get(cameraId);
  if (!session || session.orgId !== orgId) return false;
  session.lastAccess = Date.now() - IDLE_TIMEOUT_MS - 1;
  ensureReaper();
  return true;
}

export function getLiveStreamCount(): number {
  return sessions.size;
}

export function stopAllLiveStreams(): void {
  for (const session of [...sessions.values()]) teardown(session);
  if (reaperTimer) {
    clearInterval(reaperTimer);
    reaperTimer = null;
  }
}
