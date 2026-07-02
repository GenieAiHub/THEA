import { getQueues } from "../queues";
import { db } from "@workspace/db";
import { crawlerSourcesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { PRECONFIGURED_SOURCES } from "../ingestion/sources-config";
import { logger } from "../logger";

const MIROFISH_INTERVAL_MS = 60 * 60 * 1000;
const LLM_CLASSIFY_INTERVAL_MS = 15 * 60 * 1000;
const LLM_EMBED_INTERVAL_MS = 30 * 60 * 1000;

async function getActiveCategories(): Promise<string[]> {
  try {
    const rows = await db
      .selectDistinct({ category: crawlerSourcesTable.category })
      .from(crawlerSourcesTable)
      .where(eq(crawlerSourcesTable.isActive, true));
    if (rows.length > 0) return rows.map((r) => r.category).filter(Boolean) as string[];
  } catch {}
  return [...new Set(PRECONFIGURED_SOURCES.map((s) => s.category))];
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
      `mirofish-${category}`,
      { every: MIROFISH_INTERVAL_MS },
      {
        name: "mirofish",
        data: { category, windowHours: 24, triggeredBy: "scheduler" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 60000 } },
      }
    );
  }

  logger.info({ categories: categories.length }, "Analysis schedulers registered");
}
