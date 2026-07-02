import { CheerioCrawler, ProxyConfiguration } from "crawlee";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { detectLanguage } from "../language";

const PROXY_URLS = process.env.CRAWLER_PROXY_URLS?.split(",").map((u) => u.trim()).filter(Boolean) ?? [];
const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;
const robotsCache: Map<string, { allowed: boolean; expires: number }> = new Map();

async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(url);
    const cacheKey = `${protocol}//${hostname}`;
    const cached = robotsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.allowed;

    const robotsUrl = `${protocol}//${hostname}/robots.txt`;
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": "THEA-Intelligence-Bot/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      robotsCache.set(cacheKey, { allowed: true, expires: Date.now() + ROBOTS_CACHE_TTL_MS });
      return true;
    }

    const text = await res.text();
    const pathName = new URL(url).pathname;
    let inRelevantSection = false;
    let allowed = true;

    for (const line of text.split("\n")) {
      const l = line.trim().toLowerCase();
      if (l.startsWith("user-agent:")) {
        const agent = l.replace("user-agent:", "").trim();
        inRelevantSection = agent === "*" || agent === "thea-intelligence-bot";
      }
      if (inRelevantSection && l.startsWith("disallow:")) {
        const path = l.replace("disallow:", "").trim();
        if (path && pathName.startsWith(path)) {
          allowed = false;
          break;
        }
      }
    }

    robotsCache.set(cacheKey, { allowed, expires: Date.now() + ROBOTS_CACHE_TTL_MS });
    return allowed;
  } catch {
    return true;
  }
}

export async function crawlUrls(urls: string[], category: string): Promise<NormalizedItem[]> {
  if (!urls.length) return [];

  const filtered: string[] = [];
  for (const url of urls) {
    if (await checkRobotsTxt(url)) {
      filtered.push(url);
    } else {
      logger.warn({ url }, "Crawl skipped — disallowed by robots.txt");
    }
  }

  if (!filtered.length) return [];

  const storageDir = await mkdtemp(join(tmpdir(), "crawlee-thea-"));
  process.env.CRAWLEE_STORAGE_DIR = storageDir;

  const results: NormalizedItem[] = [];

  try {
    const crawlerOptions: ConstructorParameters<typeof CheerioCrawler>[0] = {
      maxConcurrency: 5,
      maxRequestsPerCrawl: filtered.length,
      navigationTimeoutSecs: 30,
      requestHandlerTimeoutSecs: 30,
      ignoreSslErrors: true,
      additionalMimeTypes: ["application/xhtml+xml"],
      async requestHandler({ request, $, response }) {
        if ((response.statusCode ?? 0) >= 400) return;

        const $body = $("body");
        $body.find("nav, footer, aside, script, style, header, .ad, .advertisement, .sidebar, .menu").remove();

        const rawTitle =
          $("meta[property='og:title']").attr("content") ||
          $("title").text() ||
          $("h1").first().text() ||
          null;

        const title = rawTitle ? rawTitle.trim().slice(0, 500) : null;

        const articleText =
          $("article").text() ||
          $("main").text() ||
          $("[role='main']").text() ||
          $body.text();

        const body = articleText.replace(/\s+/g, " ").trim();

        if (!body || body.length < 80) return;

        const domain = new URL(request.url).hostname;

        const publishedStr =
          $("meta[property='article:published_time']").attr("content") ||
          $("meta[name='date']").attr("content") ||
          $("time[datetime]").first().attr("datetime") ||
          null;

        const publishedAt = publishedStr ? new Date(publishedStr) : null;

        results.push({
          platform: "web",
          sourceUrl: request.url,
          title,
          body: body.slice(0, 2000),
          author: $("meta[name='author']").attr("content") || domain,
          publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
          language: detectLanguage(body),
          category,
          engagementMetrics: {},
          rawMetadata: { domain },
        });
      },

      async failedRequestHandler({ request, error }) {
        logger.warn({ url: request.url, error: (error as Error).message }, "Crawlee request failed");
      },
    };

    if (PROXY_URLS.length > 0) {
      crawlerOptions.proxyConfiguration = new ProxyConfiguration({ proxyUrls: PROXY_URLS });
    }

    const crawler = new CheerioCrawler(crawlerOptions);
    await crawler.run(filtered.map((url) => ({ url })));
  } catch (err) {
    logger.warn({ err }, "Crawlee crawler error");
  } finally {
    try { await rm(storageDir, { recursive: true, force: true }); } catch {}
    delete process.env.CRAWLEE_STORAGE_DIR;
  }

  return results;
}

export async function crawlUrl(url: string, category: string): Promise<NormalizedItem | null> {
  const items = await crawlUrls([url], category);
  return items[0] ?? null;
}
