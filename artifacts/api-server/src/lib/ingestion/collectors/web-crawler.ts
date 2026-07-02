import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { normalizeBody, normalizeTitle } from "../normalizer";
import { detectLanguage } from "../language";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36",
];

const POLITENESS_DELAY_MS = 1000;
const domainLastFetch: Map<string, number> = new Map();

async function politeDelay(domain: string): Promise<void> {
  const last = domainLastFetch.get(domain) ?? 0;
  const wait = POLITENESS_DELAY_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  domainLastFetch.set(domain, Date.now());
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1]?.trim() ?? null : null;
}

export async function crawlUrl(url: string, category: string): Promise<NormalizedItem | null> {
  const domain = extractDomain(url);
  await politeDelay(domain);

  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const rawText = extractTextFromHtml(html);
    const body = normalizeBody(rawText);
    const title = normalizeTitle(extractTitle(html));

    if (!body || body.length < 50) return null;

    return {
      platform: "web",
      sourceUrl: url,
      title,
      body,
      author: domain,
      publishedAt: null,
      language: detectLanguage(body),
      category,
      engagementMetrics: {},
      rawMetadata: { domain },
    };
  } catch (err) {
    logger.warn({ err, url }, "Web crawl failed");
    return null;
  }
}

export async function crawlUrls(urls: string[], category: string): Promise<NormalizedItem[]> {
  const results: NormalizedItem[] = [];
  for (const url of urls) {
    const item = await crawlUrl(url, category);
    if (item) results.push(item);
  }
  return results;
}
