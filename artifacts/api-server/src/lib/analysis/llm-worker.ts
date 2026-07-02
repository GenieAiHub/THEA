import { createWorker } from "../queues";
import { classifyBatch, checkDailySpendCap } from "./classifier";
import { embedPendingItems } from "./embeddings";
import { aggregateEntityMentions } from "./entity-tracker";
import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../logger";

export interface LlmJobData {
  itemIds?: string[];
  category?: string;
  operation: "classify" | "embed" | "classify_and_embed" | "entity_aggregate";
  windowStartMs?: number;
  windowEndMs?: number;
}

export function startLlmProcessingWorker(): void {
  createWorker<LlmJobData>("llm-processing", async (job) => {
    const { operation, itemIds, category, windowStartMs, windowEndMs } = job.data;

    logger.info({ operation, category, itemCount: itemIds?.length }, "LLM processing job started");

    const { withinCap, todayUsd, capUsd } = await checkDailySpendCap();
    if (!withinCap && operation !== "entity_aggregate") {
      logger.warn({ todayUsd, capUsd }, "Daily spend cap reached — skipping LLM job");
      return;
    }

    switch (operation) {
      case "classify": {
        if (!itemIds?.length) break;
        const items = await db
          .select({
            id: contentItemsTable.id,
            title: contentItemsTable.title,
            body: contentItemsTable.body,
            language: contentItemsTable.language,
            category: contentItemsTable.category,
          })
          .from(contentItemsTable)
          .where(inArray(contentItemsTable.id, itemIds));

        const results = await classifyBatch(items);
        for (const r of results) {
          await db
            .update(contentItemsTable)
            .set({
              sentimentScore: r.sentiment,
              entities: r.entities,
              summary: r.summary,
              category: r.category,
              processedAt: new Date(),
            })
            .where(eq(contentItemsTable.id, r.id));
        }
        logger.info({ classified: results.length }, "LLM classify job complete");
        break;
      }

      case "embed": {
        const count = await embedPendingItems(200);
        logger.info({ embedded: count }, "Embedding job complete");
        break;
      }

      case "classify_and_embed": {
        if (itemIds?.length) {
          const items = await db
            .select({
              id: contentItemsTable.id,
              title: contentItemsTable.title,
              body: contentItemsTable.body,
              language: contentItemsTable.language,
              category: contentItemsTable.category,
            })
            .from(contentItemsTable)
            .where(inArray(contentItemsTable.id, itemIds));

          const results = await classifyBatch(items);
          for (const r of results) {
            await db
              .update(contentItemsTable)
              .set({
                sentimentScore: r.sentiment,
                entities: r.entities,
                summary: r.summary,
                category: r.category,
                processedAt: new Date(),
              })
              .where(eq(contentItemsTable.id, r.id));
          }
          logger.info({ classified: results.length }, "Classification step complete");
        }
        const embedded = await embedPendingItems(200);
        logger.info({ embedded }, "Embedding step complete");
        break;
      }

      case "entity_aggregate": {
        const start = windowStartMs ? new Date(windowStartMs) : new Date(Date.now() - 60 * 60 * 1000);
        const end = windowEndMs ? new Date(windowEndMs) : new Date();
        await aggregateEntityMentions(start, end, category);
        break;
      }

      default:
        logger.warn({ operation }, "Unknown LLM processing operation");
    }
  });
}
