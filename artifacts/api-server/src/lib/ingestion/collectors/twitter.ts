import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "https://api.twitter.com/2";

const KEYWORDS_BY_CATEGORY: Record<string, string> = {
  politics: "politics OR government OR elections OR policy lang:en",
  technology: "AI OR tech OR cybersecurity OR startup lang:en",
  business: "economy OR markets OR stocks OR finance lang:en",
  society: "community OR culture OR education OR society lang:en",
  "southeast-asia": "(Malaysia OR Singapore OR Indonesia OR Thailand) lang:en",
  sports: "sports OR football OR cricket OR tournament lang:en",
  entertainment: "entertainment OR movies OR music OR celebrity lang:en",
  health: "health OR medicine OR vaccine OR disease lang:en",
  environment: "climate OR carbon OR sustainability lang:en",
};

interface TwitterTweet {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  };
}

interface TwitterResponse {
  data?: TwitterTweet[];
  errors?: Array<{ message: string }>;
}

export async function collectTwitter(category: string, bearerToken: string): Promise<NormalizedItem[]> {
  if (!bearerToken) return [];

  const query = KEYWORDS_BY_CATEGORY[category] ?? category;
  const params = new URLSearchParams({
    query: `${query} -is:retweet -is:reply`,
    max_results: "100",
    "tweet.fields": "author_id,created_at,public_metrics",
    expansions: "author_id",
    "user.fields": "name,username",
  });

  try {
    const res = await fetch(`${BASE_URL}/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401 || res.status === 403) {
      logger.warn({ category }, "Twitter: unauthorized — check TWITTER_BEARER_TOKEN");
      return [];
    }

    if (!res.ok) {
      logger.warn({ status: res.status, category }, "Twitter request failed");
      return [];
    }

    const data = await res.json() as TwitterResponse;
    if (!data.data) return [];

    return data.data.map((t) => ({
      platform: "twitter",
      sourceUrl: `https://twitter.com/i/web/status/${t.id}`,
      title: null,
      body: t.text ?? "",
      author: t.author_id ?? null,
      publishedAt: t.created_at ? new Date(t.created_at) : null,
      language: "en",
      category,
      engagementMetrics: {
        likes: t.public_metrics?.like_count ?? 0,
        shares: t.public_metrics?.retweet_count ?? 0,
        comments: t.public_metrics?.reply_count ?? 0,
        views: t.public_metrics?.impression_count ?? 0,
      },
    }));
  } catch (err) {
    logger.warn({ err, category }, "Twitter collection failed");
    return [];
  }
}
