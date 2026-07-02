import { CheerioCrawler, ProxyConfiguration } from "crawlee";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { detectLanguage } from "../language";

const PROXY_URLS = process.env.CRAWLER_PROXY_URLS?.split(",").map((u) => u.trim()).filter(Boolean) ?? [];
const USE_PLAYWRIGHT = process.env.USE_PLAYWRIGHT === "true";

const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;
const robotsCache = new Map<string, { allowed: boolean; expires: number }>();

async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(url);
    const cacheKey = `${protocol}//${hostname}`;
    const cached = robotsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.allowed;

    const res = await fetch(`${protocol}//${hostname}/robots.txt`, {
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
        if (path && pathName.startsWith(path)) { allowed = false; break; }
      }
    }

    robotsCache.set(cacheKey, { allowed, expires: Date.now() + ROBOTS_CACHE_TTL_MS });
    return allowed;
  } catch {
    return true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems($: any, url: string, category: string): NormalizedItem | null {
  const $body = $("body");
  $body.find("nav, footer, aside, script, style, header, .ad, .advertisement, .sidebar, .menu, .cookie-banner").remove();

  const rawTitle =
    $("meta[property='og:title']").attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    null;
  const title = rawTitle ? rawTitle.trim().slice(0, 500) : null;

  const articleText =
    $("article").text() || $("main").text() || $("[role='main']").text() || $body.text();
  const body = articleText.replace(/\s+/g, " ").trim();

  if (!body || body.length < 80) return null;

  const domain = new URL(url).hostname;
  const publishedStr =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    $("time[datetime]").first().attr("datetime") || null;
  const publishedAt = publishedStr ? new Date(publishedStr) : null;

  return {
    platform: "web",
    sourceUrl: url,
    title,
    body: body.slice(0, 2000),
    author: $("meta[name='author']").attr("content") || domain,
    publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
    language: detectLanguage(body),
    category,
    engagementMetrics: {},
    rawMetadata: { domain },
  };
}

async function crawlWithPlaywright(filtered: string[], category: string): Promise<NormalizedItem[]> {
  const { PlaywrightCrawler } = await import("crawlee");
  const { chromium } = await import("playwright");

  await chromium.launch({ headless: true }).then((b) => b.close());

  const results: NormalizedItem[] = [];

  const options: ConstructorParameters<typeof PlaywrightCrawler>[0] = {
    maxConcurrency: 3,
    maxRequestsPerCrawl: filtered.length,
    navigationTimeoutSecs: 45,
    requestHandlerTimeoutSecs: 45,
    headless: true,
    async requestHandler({ page, request }) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
      const cheerio = await import("cheerio");
      const html = await page.content();
      const $ = cheerio.load(html);
      const item = extractItems($, request.url, category);
      if (item) results.push(item);
    },
    async failedRequestHandler({ request, error }) {
      logger.warn({ url: request.url, error: (error as Error).message }, "Playwright request failed");
    },
  };

  if (PROXY_URLS.length > 0) {
    options.proxyConfiguration = new ProxyConfiguration({ proxyUrls: PROXY_URLS });
  }

  const crawler = new PlaywrightCrawler(options);
  await crawler.run(filtered.map((url) => ({ url })));
  return results;
}

async function crawlWithCheerio(filtered: string[], category: string): Promise<NormalizedItem[]> {
  const results: NormalizedItem[] = [];

  const options: ConstructorParameters<typeof CheerioCrawler>[0] = {
    maxConcurrency: 5,
    maxRequestsPerCrawl: filtered.length,
    navigationTimeoutSecs: 30,
    requestHandlerTimeoutSecs: 30,
    ignoreSslErrors: true,
    additionalMimeTypes: ["application/xhtml+xml"],
    async requestHandler({ request, $, response }) {
      if ((response.statusCode ?? 0) >= 400) return;
      const item = extractItems($, request.url, category);
      if (item) results.push(item);
    },
    async failedRequestHandler({ request, error }) {
      logger.warn({ url: request.url, error: (error as Error).message }, "Cheerio request failed");
    },
  };

  if (PROXY_URLS.length > 0) {
    options.proxyConfiguration = new ProxyConfiguration({ proxyUrls: PROXY_URLS });
  }

  const crawler = new CheerioCrawler(options);
  await crawler.run(filtered.map((url) => ({ url })));
  return results;
}

export async function crawlUrls(urls: string[], category: string): Promise<NormalizedItem[]> {
  if (!urls.length) return [];

  const filtered: string[] = [];
  for (const url of urls) {
    if (await checkRobotsTxt(url)) filtered.push(url);
    else logger.warn({ url }, "Crawl skipped — disallowed by robots.txt");
  }
  if (!filtered.length) return [];

  const storageDir = await mkdtemp(join(tmpdir(), "crawlee-thea-"));
  process.env.CRAWLEE_STORAGE_DIR = storageDir;

  let results: NormalizedItem[] = [];

  try {
    if (USE_PLAYWRIGHT) {
      try {
        results = await crawlWithPlaywright(filtered, category);
        logger.info({ crawled: results.length }, "Playwright crawl complete");
      } catch (err) {
        logger.warn({ err: (err as Error).message }, "Playwright unavailable — falling back to CheerioCrawler");
        results = await crawlWithCheerio(filtered, category);
      }
    } else {
      results = await crawlWithCheerio(filtered, category);
    }
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
