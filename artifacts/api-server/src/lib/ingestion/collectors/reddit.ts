import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const SUBREDDITS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["worldnews", "politics", "geopolitics", "PoliticalDiscussion", "europe", "malaysia", "singapore"],
  technology: ["technology", "programming", "artificial", "MachineLearning", "cybersecurity", "netsec", "crypto"],
  business: ["investing", "stocks", "economics", "personalfinance", "wallstreetbets", "business", "economy"],
  society: ["AskReddit", "science", "education", "todayilearned", "explainlikeimfive", "changemyview"],
  sports: ["sports", "soccer", "nba", "formula1", "cricket", "MMA"],
  entertainment: ["movies", "television", "Music", "gaming", "books", "anime"],
  health: ["health", "medicine", "fitness", "mentalhealth", "nutrition", "diabetes"],
  environment: ["environment", "climate", "ZeroWaste", "sustainability", "collapse"],
  "southeast-asia": ["malaysia", "singapore", "indonesia", "Thailand", "Philippines", "vietnam", "SEA"],
};

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  url?: string;
  score?: number;
  num_comments?: number;
  author?: string;
  created_utc?: number;
  permalink?: string;
  subreddit?: string;
}

export async function collectReddit(
  category: string,
  clientId: string,
  clientSecret: string
): Promise<NormalizedItem[]> {
  if (!clientId || !clientSecret) return [];

  try {
    const token = await getRedditToken(clientId, clientSecret);
    if (!token) return [];

    const subreddits = SUBREDDITS_BY_CATEGORY[category] ?? ["worldnews"];
    const results: NormalizedItem[] = [];

    await Promise.allSettled(
      subreddits.slice(0, 10).map(async (sub) => {
        const posts = await fetchSubreddit(sub, token, category);
        results.push(...posts);
      })
    );

    return results;
  } catch (err) {
    logger.warn({ err, category }, "Reddit collection failed");
    return [];
  }
}

async function getRedditToken(clientId: string, clientSecret: string): Promise<string | null> {
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "THEA-Intelligence-Bot/1.0",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, "Reddit OAuth token request failed");
    return null;
  }

  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function fetchSubreddit(sub: string, token: string, category: string): Promise<NormalizedItem[]> {
  const res = await fetch(`https://oauth.reddit.com/r/${sub}/hot?limit=25`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "THEA-Intelligence-Bot/1.0",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = await res.json() as { data?: { children?: Array<{ data: RedditPost }> } };
  const posts = data.data?.children ?? [];

  return posts.map((p) => {
    const post = p.data;
    const body = post.selftext && post.selftext !== "[deleted]"
      ? `${post.title}\n\n${post.selftext}`
      : post.title;

    return {
      platform: "reddit",
      sourceUrl: post.permalink ? `https://reddit.com${post.permalink}` : (post.url ?? ""),
      title: post.title ?? null,
      body,
      author: post.author ?? null,
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000) : null,
      language: "en",
      category,
      engagementMetrics: {
        score: post.score ?? 0,
        comments: post.num_comments ?? 0,
      },
      rawMetadata: { subreddit: post.subreddit },
    };
  });
}
