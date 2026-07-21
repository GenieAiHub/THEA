import { createWorker } from "../queues";
import { classifyBatch, classifyPendingItems, checkDailySpendCap } from "./classifier";
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
        // Loop through the backlog in batches so a large un-embedded backlog
        // drains in hours instead of weeks. Re-check the spend cap between
        // batches so a long run can't blow past the daily budget.
        const BATCH = 500;
        const MAX_BATCHES = 10;
        let total = 0;
        for (let i = 0; i < MAX_BATCHES; i++) {
          const cap = await checkDailySpendCap();
          if (!cap.withinCap) {
            logger.warn({ todayUsd: cap.todayUsd, capUsd: cap.capUsd }, "Spend cap hit mid-embedding — stopping batch loop");
            break;
          }
          const count = await embedPendingItems(BATCH);
          total += count;
          if (count < BATCH) break;
        }
        logger.info({ embedded: total }, "Embedding job complete");
        break;
      }

      case "classify_and_embed": {
        let classified = 0;
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
          classified = results.length;
        } else {
          classified = await classifyPendingItems(category, 200);
        }
        logger.info({ classified }, "Classification step complete");
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
