import { getQueues } from "../queues";
import { db } from "@workspace/db";
import { crawlerSourcesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { PRECONFIGURED_SOURCES } from "../ingestion/sources-config";
import { getPlatformConfigNumber } from "../platform-config";
import { logger } from "../logger";

// Default cadences (minutes). Operators can override each via platform_configs
// (mirofish_interval_minutes / llm_classify_interval_minutes / llm_embed_interval_minutes)
// from the Super Admin → Scheduler page; re-run scheduleAnalysis() to apply.
const DEFAULT_MIROFISH_INTERVAL_MIN = 60;
const DEFAULT_LLM_CLASSIFY_INTERVAL_MIN = 15;
const DEFAULT_LLM_EMBED_INTERVAL_MIN = 30;

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

export async function getActiveCategories(): Promise<string[]> {
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

  const [mirofishMin, classifyMin, embedMin] = await Promise.all([
    getPlatformConfigNumber("mirofish_interval_minutes", DEFAULT_MIROFISH_INTERVAL_MIN),
    getPlatformConfigNumber("llm_classify_interval_minutes", DEFAULT_LLM_CLASSIFY_INTERVAL_MIN),
    getPlatformConfigNumber("llm_embed_interval_minutes", DEFAULT_LLM_EMBED_INTERVAL_MIN),
  ]);

  // Guard against a mis-typed 0/negative interval that would spam the queue.
  const mirofishMs = Math.max(1, mirofishMin) * 60 * 1000;
  const classifyMs = Math.max(1, classifyMin) * 60 * 1000;
  const embedMs = Math.max(1, embedMin) * 60 * 1000;

  await llmProcessing.upsertJobScheduler(
    "llm-classify-pending",
    { every: classifyMs },
    {
      name: "classify",
      data: { operation: "classify_and_embed" },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 30000 } },
    }
  );

  await llmProcessing.upsertJobScheduler(
    "llm-embed-pending",
    { every: embedMs },
    {
      name: "embed",
      data: { operation: "embed" },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 30000 } },
    }
  );

  for (const category of categories) {
    await miroFishRuns.upsertJobScheduler(
      `mirofish-${category.toLowerCase()}`,
      { every: mirofishMs },
      {
        name: "mirofish",
        data: { category, windowHours: 24, triggeredBy: "scheduler" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 60000 } },
      }
    );
  }

  logger.info(
    { categories: categories.length, categoryList: categories, mirofishMin, classifyMin, embedMin },
    "Analysis schedulers registered"
  );
}
