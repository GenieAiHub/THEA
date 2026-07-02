import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { PLATFORM_ORG_ID } from "./system-org";
import { computeHash, isDuplicate, markSeen, addSourceUrlToExisting } from "./deduplicator";
import { detectLanguage } from "./language";
import { normalizeBody, normalizeTitle } from "./normalizer";
import type { NormalizedItem } from "./types";
import { logger } from "../logger";
import { getElasticsearch, CONTENT_ITEMS_INDEX } from "../elasticsearch";
import { getQueues } from "../queues";

interface IngestionStats {
  fetched: number;
  deduplicated: number;
  stored: number;
}

export async function ingestItems(
  items: NormalizedItem[],
  orgId = PLATFORM_ORG_ID
): Promise<IngestionStats> {
  const stats: IngestionStats = { fetched: items.length, deduplicated: 0, stored: 0 };
  const newItemIds: string[] = [];

  for (const item of items) {
    try {
      const body = normalizeBody(item.body);
      if (!body || body.length < 10) continue;

      const contentHash = computeHash(body);
      const duplicateId = await isDuplicate(contentHash, orgId);

      if (duplicateId) {
        stats.deduplicated++;
        if (item.sourceUrl) {
          await addSourceUrlToExisting(duplicateId, item.sourceUrl);
        }
        continue;
      }

      const language = item.language && item.language !== "en"
        ? item.language
        : detectLanguage(body);

      const [inserted] = await db
        .insert(contentItemsTable)
        .values({
          orgId,
          contentHash,
          platform: item.platform,
          sourceUrl: item.sourceUrl,
          sourceUrls: item.sourceUrl ? [item.sourceUrl] : [],
          title: normalizeTitle(item.title),
          body,
          author: item.author ?? null,
          language,
          category: item.category,
          publishedAt: item.publishedAt ?? null,
          engagementMetrics: item.engagementMetrics ?? {},
          rawMetadata: item.rawMetadata ?? {},
        })
        .returning({ id: contentItemsTable.id });

      if (inserted) {
        stats.stored++;
        newItemIds.push(inserted.id);
        await markSeen(contentHash, orgId, inserted.id);
        await indexInElasticsearch(inserted.id, { ...item, body, language, orgId, contentHash });
      }
    } catch (err) {
      logger.warn({ err, url: item.sourceUrl }, "Failed to ingest item");
    }
  }

  if (newItemIds.length > 0) {
    enqueueLlmProcessing(newItemIds).catch((err) =>
      logger.warn({ err }, "Failed to enqueue LLM processing — items stored without LLM enrichment")
    );
  }

  return stats;
}

async function enqueueLlmProcessing(itemIds: string[]): Promise<void> {
  const { llmProcessing } = getQueues();
  const CHUNK_SIZE = 20;
  for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
    const chunk = itemIds.slice(i, i + CHUNK_SIZE);
    await llmProcessing.add(
      "classify-after-ingest",
      { operation: "classify_and_embed" as const, itemIds: chunk },
      { attempts: 3, backoff: { type: "exponential", delay: 15000 }, priority: 10 }
    );
  }
}

async function indexInElasticsearch(
  id: string,
  item: NormalizedItem & { orgId: string; contentHash: string; language: string }
): Promise<void> {
  try {
    const es = getElasticsearch();
    await es.index({
      index: CONTENT_ITEMS_INDEX,
      id,
      document: {
        id,
        orgId: item.orgId,
        platform: item.platform,
        category: item.category,
        language: item.language,
        title: item.title,
        body: item.body,
        author: item.author,
        publishedAt: item.publishedAt?.toISOString(),
        collectedAt: new Date().toISOString(),
        engagementMetrics: item.engagementMetrics,
      },
    });
  } catch (err) {
    logger.warn({ err, id }, "Elasticsearch indexing failed — item is in DB but missing from search");
  }
}
