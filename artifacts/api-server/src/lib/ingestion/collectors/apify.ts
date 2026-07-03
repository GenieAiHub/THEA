import { logger } from "../../logger";

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Run an Apify actor synchronously and return its dataset items.
 *
 * Apify is the managed-scraper engine for Facebook/Instagram: it runs the
 * scrapers behind rotating residential proxies so the platform's own server is
 * never blocked and no login account gets banned. Requires an Apify API token
 * (`apify_token`). Actor IDs are configurable so operators can swap actors
 * without a redeploy.
 *
 * Uses `run-sync-get-dataset-items`, which blocks until the run finishes (max
 * ~300s server-side) and returns the scraped items directly as a JSON array.
 */
export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutMs = 240000,
): Promise<T[]> {
  if (!actorId || !token) return [];

  // Apify path format uses "~" instead of "/" (owner~actor-name).
  const path = actorId.replace("/", "~");
  const url = `${APIFY_BASE}/acts/${path}/run-sync-get-dataset-items`;

  try {
    // Token is sent as a Bearer header (not a query param) to keep it out of
    // any intermediary request logs.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn(
        { actorId, status: res.status, body: body.slice(0, 300) },
        "Apify actor run failed — check APIFY_TOKEN, actor id, and account credit",
      );
      return [];
    }

    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) {
      logger.warn({ actorId }, "Apify actor returned a non-array payload");
      return [];
    }
    return data as T[];
  } catch (err) {
    logger.warn({ actorId, err: (err as Error).message }, "Apify actor request errored");
    return [];
  }
}
