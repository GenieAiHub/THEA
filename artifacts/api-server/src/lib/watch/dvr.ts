/**
 * DVR/NVR integration: builds per-channel RTSP URLs from well-known brand
 * templates so an org can bulk-import every channel of a recorder as
 * individual Security Watch cameras.
 *
 * Sub-stream is the recommended default — DVRs cap concurrent RTSP sessions
 * per channel, and the frame sampler + live viewing already hold up to two.
 */

export const DVR_BRANDS = ["hikvision", "dahua", "amcrest", "uniview", "reolink", "generic"] as const;
export type DvrBrand = (typeof DVR_BRANDS)[number];

export type DvrStreamQuality = "main" | "sub";

export const MAX_DVR_CHANNELS = 64;

export interface DvrChannelUrlOptions {
  brand: DvrBrand;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  channel: number;
  quality: DvrStreamQuality;
  /** For brand "generic": a full RTSP URL template containing "{channel}". */
  urlPattern?: string;
}

export function isDvrBrand(value: unknown): value is DvrBrand {
  return typeof value === "string" && (DVR_BRANDS as readonly string[]).includes(value);
}

function credentialPrefix(username?: string, password?: string): string {
  if (!username) return "";
  const user = encodeURIComponent(username);
  const pass = password ? `:${encodeURIComponent(password)}` : "";
  return `${user}${pass}@`;
}

/**
 * Returns the RTSP URL for one DVR channel, or throws with a user-facing
 * message when the inputs cannot produce a valid URL.
 */
export function buildDvrChannelUrl(opts: DvrChannelUrlOptions): string {
  const { brand, channel, quality } = opts;
  if (!Number.isInteger(channel) || channel < 1 || channel > MAX_DVR_CHANNELS) {
    throw new Error(`channel must be an integer between 1 and ${MAX_DVR_CHANNELS}`);
  }

  if (brand === "generic") {
    const pattern = opts.urlPattern?.trim();
    if (!pattern) throw new Error("urlPattern is required for the generic brand");
    if (!pattern.includes("{channel}")) throw new Error('urlPattern must contain the "{channel}" placeholder');
    const url = pattern.replaceAll("{channel}", String(channel));
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "rtsp:" && parsed.protocol !== "rtsps:") {
        throw new Error("urlPattern must be an rtsp:// or rtsps:// URL");
      }
    } catch (err) {
      throw new Error(err instanceof Error && err.message.includes("urlPattern") ? err.message : "urlPattern is not a valid URL");
    }
    return url;
  }

  const host = opts.host?.trim();
  if (!host) throw new Error("host is required");
  if (host.includes("/") || host.includes("@") || host.includes(" ")) {
    throw new Error("host must be a bare hostname or IP (no scheme, path or credentials)");
  }
  const port = opts.port ?? 554;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port must be between 1 and 65535");
  const auth = credentialPrefix(opts.username, opts.password);
  const base = `rtsp://${auth}${host}:${port}`;

  switch (brand) {
    case "hikvision":
      // Channel 1 main = 101, sub = 102; channel 2 = 201/202, etc.
      return `${base}/Streaming/Channels/${channel}${quality === "main" ? "01" : "02"}`;
    case "dahua":
    case "amcrest":
      return `${base}/cam/realmonitor?channel=${channel}&subtype=${quality === "main" ? 0 : 1}`;
    case "uniview":
      return `${base}/unicast/c${channel}/s${quality === "main" ? 0 : 1}/live`;
    case "reolink":
      return `${base}/h264Preview_${String(channel).padStart(2, "0")}_${quality === "main" ? "main" : "sub"}`;
    default: {
      const exhaustive: never = brand;
      throw new Error(`Unsupported DVR brand: ${String(exhaustive)}`);
    }
  }
}
