import { getQueues } from "../queues";
import { db } from "@workspace/db";
import { crawlerSourcesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { PRECONFIGURED_SOURCES } from "../ingestion/sources-config";
import { logger } from "../logger";

const MIROFISH_INTERVAL_MS = 60 * 60 * 1000;
const LLM_CLASSIFY_INTERVAL_MS = 15 * 60 * 1000;
const LLM_EMBED_INTERVAL_MS = 30 * 60 * 1000;

const VALID_CATEGORIES = [
  "Politics", "News", "Technology", "Society", "Media", "Branding",
  "Entertainment", "Health", "Sports", "Environment", "Crypto",
] as const;

const CATEGORY_MAP = new Map(VALID_CATEGORIES.map((c) => [c.toLowerCase(), c]));

function canonicalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().replace(/-/g, " ").trim();
  if (CATEGORY_MAP.has(lower)) return CATEGORY_MAP.get(lower)!;
  for (const valid of VALID_CATEGORIES) {
    if (lower.includes(valid.toLowerCase())) return valid;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

async function getActiveCategories(): Promise<string[]> {
  let rawCategories: string[];
  try {
    const rows = await db
      .selectDistinct({ category: crawlerSourcesTable.category })
      .from(crawlerSourcesTable)
      .where(eq(crawlerSourcesTable.isActive, true));
    rawCategories = rows.length > 0
      ? (rows.map((r) => r.category).filter(Boolean) as string[])
      : PRECONFIGURED_SOURCES.map((s) => s.category);
  } catch {
    rawCategories = PRECONFIGURED_SOURCES.map((s) => s.category);
  }
  return [...new Set(rawCategories.map(canonicalizeCategory))];
}

export async function scheduleAnalysis(): Promise<void> {
  const { llmProcessing, miroFishRuns } = getQueues();
  const categories = await getActiveCategories();

  await llmProcessing.upsertJobScheduler(
    "llm-classify-pending",
    { every: LLM_CLASSIFY_INTERVAL_MS },
    {
      name: "classify",
      data: { operation: "classify_and_embed" },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 30000 } },
    }
  );

  await llmProcessing.upsertJobScheduler(
    "llm-embed-pending",
    { every: LLM_EMBED_INTERVAL_MS },
    {
      name: "embed",
      data: { operation: "embed" },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 30000 } },
    }
  );

  for (const category of categories) {
    await miroFishRuns.upsertJobScheduler(
      `mirofish-${category.toLowerCase()}`,
      { every: MIROFISH_INTERVAL_MS },
      {
        name: "mirofish",
        data: { category, windowHours: 24, triggeredBy: "scheduler" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 60000 } },
      }
    );
  }

  logger.info({ categories: categories.length, categoryList: categories }, "Analysis schedulers registered");
}
