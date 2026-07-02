import { CheerioCrawler, ProxyConfiguration, log as crawleeLog } from "crawlee";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { detectLanguage } from "../language";
import { getPlatformConfig, getPlatformConfigBool } from "../../platform-config";

/** Resolve proxy URLs (DB-backed, env fallback) from a comma-separated list. */
async function getProxyUrls(): Promise<string[]> {
  const raw = (await getPlatformConfig("crawler_proxy_urls")) ?? "";
  return raw.split(",").map((u) => u.trim()).filter(Boolean);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
];

function randomUa(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

// Per-domain request timing (1 req/sec politeness)
const domainLastRequest = new Map<string, number>();
const DOMAIN_MIN_DELAY_MS = 1000;

async function waitForDomain(hostname: string): Promise<void> {
  const last = domainLastRequest.get(hostname) ?? 0;
  const now = Date.now();
  const wait = DOMAIN_MIN_DELAY_MS - (now - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  domainLastRequest.set(hostname, Date.now());
}

const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;
const robotsCache = new Map<string, { allowed: boolean; expires: number }>();

async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(url);
    const cacheKey = `${protocol}//${hostname}`;
    const cached = robotsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.allowed;

    const res = await fetch(`${protocol}//${hostname}/robots.txt`, {
      headers: { "User-Agent": "THEA-Intelligence-Bot/1.0 (+https://thea.ai/bot)" },
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

  const testBrowser = await chromium.launch({ headless: true });
  await testBrowser.close();

  const results: NormalizedItem[] = [];
  const options: ConstructorParameters<typeof PlaywrightCrawler>[0] = {
    maxConcurrency: 3,
    maxRequestsPerCrawl: filtered.length,
    navigationTimeoutSecs: 45,
    requestHandlerTimeoutSecs: 45,
    headless: true,
    useSessionPool: true,
    async requestHandler({ page, request }) {
      const { hostname } = new URL(request.url);
      await waitForDomain(hostname);
      await page.setExtraHTTPHeaders({ "User-Agent": randomUa() });
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
  const proxyUrls = await getProxyUrls();
  if (proxyUrls.length > 0) {
    options.proxyConfiguration = new ProxyConfiguration({ proxyUrls });
  }
  const crawler = new PlaywrightCrawler(options);
  await crawler.run(filtered.map((url) => ({ url, headers: { "User-Agent": randomUa() } })));
  return results;
}

async function crawlWithCheerio(filtered: string[], category: string): Promise<NormalizedItem[]> {
  const results: NormalizedItem[] = [];
  const options: ConstructorParameters<typeof CheerioCrawler>[0] = {
    maxConcurrency: 3,
    maxRequestsPerCrawl: filtered.length,
    maxRequestsPerMinute: 20,
    navigationTimeoutSecs: 30,
    requestHandlerTimeoutSecs: 30,
    ignoreSslErrors: true,
    additionalMimeTypes: ["application/xhtml+xml"],
    useSessionPool: true,
    async requestHandler({ request, $, response }) {
      if ((response.statusCode ?? 0) >= 400) return;
      const { hostname } = new URL(request.url);
      await waitForDomain(hostname);
      const item = extractItems($, request.url, category);
      if (item) results.push(item);
    },
    async failedRequestHandler({ request, error }) {
      logger.warn({ url: request.url, error: (error as Error).message }, "Cheerio request failed");
    },
  };
  const proxyUrls = await getProxyUrls();
  if (proxyUrls.length > 0) {
    options.proxyConfiguration = new ProxyConfiguration({ proxyUrls });
  }
  const crawler = new CheerioCrawler(options);
  await crawler.run(filtered.map((url) => ({ url, headers: { "User-Agent": randomUa() } })));
  return results;
}

export async function crawlUrls(urls: string[], category: string): Promise<NormalizedItem[]> {
  if (!urls.length) return [];

  crawleeLog.setLevel(crawleeLog.LEVELS.WARNING);

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
    if (await getPlatformConfigBool("use_playwright", false)) {
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
