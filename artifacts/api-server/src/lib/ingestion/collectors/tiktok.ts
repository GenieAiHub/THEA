import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

const KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["politics", "news", "government", "election"],
  technology: ["tech", "AI", "programming", "gadgets"],
  business: ["business", "finance", "stocks", "economy"],
  society: ["society", "culture", "lifestyle", "education"],
  "southeast-asia": ["Malaysia", "Singapore", "Indonesia", "Thailand"],
  sports: ["sports", "football", "basketball", "olympics"],
  entertainment: ["entertainment", "celebrity", "movies", "music"],
  health: ["health", "fitness", "medicine", "wellness"],
  environment: ["climate", "environment", "sustainability"],
  crypto: ["crypto", "bitcoin", "blockchain", "NFT"],
};

interface TikTokVideo {
  id?: string;
  title?: string;
  video_description?: string;
  author_name?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  share_url?: string;
}

interface TikTokQueryResponse {
  data?: {
    videos?: TikTokVideo[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function collectTikTok(category: string, clientKey: string, clientSecret: string): Promise<NormalizedItem[]> {
  if (!clientKey || !clientSecret) return [];

  const token = await getTikTokToken(clientKey, clientSecret);
  if (!token) return [];

  const keywords = KEYWORDS_BY_CATEGORY[category] ?? [category];
  const items: NormalizedItem[] = [];

  await Promise.allSettled(
    keywords.slice(0, 3).map(async (keyword) => {
      try {
        const videos = await searchTikTokVideos(keyword, token, category);
        items.push(...videos);
      } catch (err) {
        logger.warn({ err, keyword }, "TikTok video search failed");
      }
    })
  );

  return items;
}

async function getTikTokToken(clientKey: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "TikTok OAuth token request failed");
      return null;
    }

    const data = await res.json() as { access_token?: string; error?: string };
    if (data.error) {
      logger.warn({ error: data.error }, "TikTok token error");
      return null;
    }

    return data.access_token ?? null;
  } catch (err) {
    logger.warn({ err }, "TikTok token fetch failed");
    return null;
  }
}

async function searchTikTokVideos(keyword: string, token: string, category: string): Promise<NormalizedItem[]> {
  const startMs = Date.now() - 24 * 60 * 60 * 1000;

  const res = await fetch(`${TIKTOK_API_BASE}/research/video/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        and: [{ operation: "IN", field_name: "keyword", field_values: [keyword] }],
      },
      start_date: new Date(startMs).toISOString().slice(0, 10).replace(/-/g, ""),
      end_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      max_count: 20,
      fields: "id,title,video_description,create_time,author_name,view_count,like_count,comment_count,share_count,share_url",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 403 || res.status === 401) {
    logger.warn({ keyword }, "TikTok Research API: unauthorized — check TIKTOK_CLIENT_KEY/SECRET and researcher approval status");
    return [];
  }

  if (!res.ok) {
    logger.warn({ status: res.status, keyword }, "TikTok Research API request failed");
    return [];
  }

  const data = await res.json() as TikTokQueryResponse;

  if (data.error) {
    logger.warn({ error: data.error, keyword }, "TikTok Research API error");
    return [];
  }

  return (data.data?.videos ?? []).map((v) => ({
    platform: "tiktok",
    sourceUrl: v.share_url ?? `https://www.tiktok.com/@${v.author_name}/video/${v.id}`,
    title: v.title ?? null,
    body: v.video_description || v.title || "",
    author: v.author_name ?? null,
    publishedAt: v.create_time ? new Date(v.create_time * 1000) : null,
    language: "en",
    category,
    engagementMetrics: {
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
    },
    rawMetadata: { keyword, videoId: v.id },
  }));
}
