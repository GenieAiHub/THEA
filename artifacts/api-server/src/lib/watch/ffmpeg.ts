/**
 * Thin ffmpeg/ffprobe wrappers. Always spawned with an args array (never a
 * shell string) and hard kill timeouts so a wedged stream can't pile up
 * zombie processes.
 */
import { spawn } from "node:child_process";
import { logger } from "../logger";

let ffmpegAvailable: boolean | null = null;

/** Probe once whether ffmpeg is on PATH. */
export async function probeFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  ffmpegAvailable = await new Promise<boolean>((resolveP) => {
    try {
      const p = spawn("ffmpeg", ["-version"], { stdio: ["ignore", "ignore", "ignore"] });
      const t = setTimeout(() => {
        p.kill("SIGKILL");
        resolveP(false);
      }, 5000);
      p.on("error", () => {
        clearTimeout(t);
        resolveP(false);
      });
      p.on("exit", (code) => {
        clearTimeout(t);
        resolveP(code === 0);
      });
    } catch {
      resolveP(false);
    }
  });
  if (!ffmpegAvailable) logger.warn("ffmpeg not found on PATH — Security Watch live sampling and video scanning disabled");
  return ffmpegAvailable;
}

export function isFfmpegAvailable(): boolean {
  return ffmpegAvailable === true;
}

/** Cameras may live on a LAN, so unlike outbound webhooks there is NO private-IP block here. */
const ALLOWED_SCHEMES = new Set(["rtsp:", "rtsps:", "http:", "https:"]);

export function validateStreamUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL";
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return `Unsupported scheme "${parsed.protocol}" — use rtsp, rtsps, http or https`;
  }
  return null;
}

function runFfmpeg(args: string[], timeoutMs: number, collectStdout: boolean): Promise<{ code: number | null; stdout: Buffer; stderr: string }> {
  return new Promise((resolveP, rejectP) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", collectStdout ? "pipe" : "ignore", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      p.kill("SIGKILL");
    }, timeoutMs);
    if (collectStdout) p.stdout!.on("data", (c: Buffer) => chunks.push(c));
    p.stderr!.on("data", (c: Buffer) => {
      if (stderr.length < 4096) stderr += c.toString();
    });
    p.on("error", (err) => {
      clearTimeout(t);
      rejectP(err);
    });
    p.on("close", (code) => {
      clearTimeout(t);
      if (killed) {
        rejectP(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
        return;
      }
      resolveP({ code, stdout: Buffer.concat(chunks), stderr });
    });
  });
}

/** Grab a single JPEG frame from a live stream. */
export async function captureFrame(streamUrl: string, timeoutMs = 12000): Promise<Buffer> {
  const parsed = new URL(streamUrl);
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  if (parsed.protocol === "rtsp:" || parsed.protocol === "rtsps:") {
    args.push("-rtsp_transport", "tcp");
  }
  args.push("-i", streamUrl, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "pipe:1");
  const { code, stdout, stderr } = await runFfmpeg(args, timeoutMs, true);
  if (code !== 0 || stdout.length === 0) {
    throw new Error(stderr.trim().split("\n").pop() || `ffmpeg exited with code ${code}`);
  }
  return stdout;
}

/** Duration in seconds via ffprobe (falls back to null when unparsable). */
export function ffprobeDuration(filePath: string, timeoutMs = 15000): Promise<number | null> {
  return new Promise((resolveP) => {
    try {
      const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      let out = "";
      const t = setTimeout(() => {
        p.kill("SIGKILL");
        resolveP(null);
      }, timeoutMs);
      p.stdout.on("data", (c: Buffer) => {
        out += c.toString();
      });
      p.on("error", () => {
        clearTimeout(t);
        resolveP(null);
      });
      p.on("close", () => {
        clearTimeout(t);
        const d = parseFloat(out.trim());
        resolveP(Number.isFinite(d) && d > 0 ? d : null);
      });
    } catch {
      resolveP(null);
    }
  });
}

/**
 * Extract frames from a video file at the given sampling rate into outDir as
 * frame_%06d.jpg. Timeout scales with duration (transcode-bound).
 */
export async function extractFrames(videoPath: string, outDir: string, everySeconds: number, durationSec: number | null): Promise<void> {
  const timeoutMs = Math.min(10 * 60_000, Math.max(60_000, (durationSec ?? 300) * 1000));
  const args = [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-i", videoPath,
    "-vf", `fps=1/${everySeconds}`,
    "-q:v", "4",
    `${outDir}/frame_%06d.jpg`,
  ];
  const { code, stderr } = await runFfmpeg(args, timeoutMs, false);
  if (code !== 0) {
    throw new Error(stderr.trim().split("\n").pop() || `ffmpeg frame extraction failed (code ${code})`);
  }
}
