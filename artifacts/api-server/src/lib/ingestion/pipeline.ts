import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { PLATFORM_ORG_ID } from "./system-org";
import { computeHash, isDuplicate, markSeen, addSourceUrlToExisting } from "./deduplicator";
import { detectLanguage } from "./language";
import { normalizeBody, normalizeTitle } from "./normalizer";
import type { NormalizedItem } from "./types";
import { logger } from "../logger";
import { getElasticsearch, CONTENT_ITEMS_INDEX } from "../elasticsearch";

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
        })
        .returning({ id: contentItemsTable.id });

      if (inserted) {
        stats.stored++;
        await markSeen(contentHash, orgId, inserted.id);
        await indexInElasticsearch(inserted.id, { ...item, body, language, orgId, contentHash });
      }
    } catch (err) {
      logger.warn({ err, url: item.sourceUrl }, "Failed to ingest item");
    }
  }

  return stats;
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
  } catch {
  }
}
