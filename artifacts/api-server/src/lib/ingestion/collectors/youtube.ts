import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

const KEYWORDS_BY_CATEGORY: Record<string, string> = {
  politics: "politics government news",
  technology: "AI technology artificial intelligence tech news",
  business: "business economy market finance news",
  society: "society culture education news",
  "southeast-asia": "Malaysia Singapore Indonesia Thailand news",
  sports: "sports news latest",
  entertainment: "entertainment celebrity movies music",
  health: "health medicine news",
  environment: "climate change environment news",
};

interface YouTubeItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelTitle?: string;
    thumbnails?: unknown;
  };
}

interface YouTubeResponse {
  items?: YouTubeItem[];
  error?: { message: string };
}

interface YouTubeVideoDetails {
  id?: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeVideoResponse {
  items?: YouTubeVideoDetails[];
}

export async function collectYouTube(category: string, apiKey: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  const query = KEYWORDS_BY_CATEGORY[category] ?? category;

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "50",
      order: "date",
      publishedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      key: apiKey,
    });

    const res = await fetch(`${BASE_URL}/search?${params}`, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      logger.warn({ status: res.status, category }, "YouTube search failed");
      return [];
    }

    const data = await res.json() as YouTubeResponse;
    if (data.error) {
      logger.warn({ message: data.error.message, category }, "YouTube API error");
      return [];
    }

    const items = (data.items ?? []).filter((i) => i.id?.videoId);
    const videoIds = items.map((i) => i.id!.videoId!);
    const stats = await fetchVideoStats(videoIds, apiKey);

    return items.map((item) => {
      const videoId = item.id!.videoId!;
      const s = item.snippet;
      const videoStats = stats[videoId];

      return {
        platform: "youtube",
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: s?.title ?? null,
        body: s?.description || s?.title || "",
        author: s?.channelTitle ?? null,
        publishedAt: s?.publishedAt ? new Date(s.publishedAt) : null,
        language: "en",
        category,
        engagementMetrics: {
          views: videoStats?.viewCount ? parseInt(videoStats.viewCount, 10) : 0,
          likes: videoStats?.likeCount ? parseInt(videoStats.likeCount, 10) : 0,
          comments: videoStats?.commentCount ? parseInt(videoStats.commentCount, 10) : 0,
        },
        rawMetadata: { videoId },
      };
    });
  } catch (err) {
    logger.warn({ err, category }, "YouTube collection failed");
    return [];
  }
}

async function fetchVideoStats(videoIds: string[], apiKey: string): Promise<Record<string, YouTubeVideoDetails["statistics"]>> {
  if (!videoIds.length) return {};

  try {
    const params = new URLSearchParams({
      part: "statistics",
      id: videoIds.join(","),
      key: apiKey,
    });

    const res = await fetch(`${BASE_URL}/videos?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return {};

    const data = await res.json() as YouTubeVideoResponse;
    const result: Record<string, YouTubeVideoDetails["statistics"]> = {};
    for (const item of data.items ?? []) {
      if (item.id) result[item.id] = item.statistics;
    }
    return result;
  } catch {
    return {};
  }
}
