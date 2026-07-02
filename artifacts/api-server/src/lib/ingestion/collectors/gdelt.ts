import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["elections", "government", "parliament", "policy", "president", "minister"],
  technology: ["artificial intelligence", "cybersecurity", "tech startup", "software"],
  business: ["economy", "market", "stocks", "trade", "finance", "inflation"],
  society: ["social media", "public opinion", "community", "culture", "education"],
  environment: ["climate change", "carbon emissions", "sustainability", "weather"],
  health: ["health", "disease", "medicine", "pandemic", "vaccine"],
  sports: ["sports", "football", "olympics", "tournament", "championship"],
  entertainment: ["entertainment", "film", "music", "celebrity", "media"],
  "southeast-asia": ["Malaysia", "Singapore", "Indonesia", "Thailand", "Philippines"],
};

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export async function collectGdelt(category: string, maxItems = 50): Promise<NormalizedItem[]> {
  const keywords = KEYWORDS_BY_CATEGORY[category] ?? [category];
  const keyword = keywords.slice(0, 3).join(" OR ");

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const sinceStr = since.toISOString().replace(/[-:T.]/g, "").slice(0, 14);

  const url = `${GDELT_BASE}?query=${encodeURIComponent(keyword)}&mode=artlist&maxrecords=${maxItems}&startdatetime=${sinceStr}&format=json&sort=DateDesc`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "THEA-Intelligence-Bot/1.0" },
    });

    if (!res.ok) {
      logger.warn({ status: res.status, category }, "GDELT request failed");
      return [];
    }

    const data = await res.json() as GdeltResponse;
    const articles = data.articles ?? [];

    return articles.map((a) => ({
      platform: "gdelt",
      sourceUrl: a.url ?? "",
      title: a.title ?? null,
      body: a.title ?? "",
      author: a.domain ?? null,
      publishedAt: a.seendate ? parseGdeltDate(a.seendate) : null,
      language: mapGdeltLang(a.language),
      category,
      engagementMetrics: {},
      rawMetadata: { domain: a.domain, sourcecountry: a.sourcecountry },
    }));
  } catch (err) {
    logger.warn({ err, category }, "GDELT collection failed");
    return [];
  }
}

function parseGdeltDate(s: string): Date | null {
  try {
    return new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`
    );
  } catch {
    return null;
  }
}

function mapGdeltLang(lang?: string): string {
  if (!lang) return "en";
  const map: Record<string, string> = {
    English: "en", Malay: "ms", Chinese: "zh", Tamil: "ta",
    Arabic: "ar", French: "fr", Spanish: "es", German: "de",
    Indonesian: "id", Thai: "th",
  };
  return map[lang] ?? "en";
}

export async function collectGdeltAllCategories(): Promise<NormalizedItem[]> {
  const categories = Object.keys(KEYWORDS_BY_CATEGORY);
  const results = await Promise.allSettled(
    categories.map((cat) => collectGdelt(cat, 25))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
