import { db } from "@workspace/db";
import { collectionRunsTable, crawlerSourcesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";

export async function startRun(sourceType: string, sourceId?: string): Promise<string> {
  const [run] = await db
    .insert(collectionRunsTable)
    .values({ sourceType, sourceId, status: "running" })
    .returning({ id: collectionRunsTable.id });
  return run!.id;
}

export async function completeRun(
  runId: string,
  sourceId: string | undefined,
  fetched: number,
  deduplicated: number,
  stored: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db
    .update(collectionRunsTable)
    .set({
      status: "completed",
      itemsFetched: fetched,
      itemsDeduplicated: deduplicated,
      itemsStored: stored,
      completedAt: new Date(),
      metadata: metadata ?? {},
    })
    .where(eq(collectionRunsTable.id, runId));

  if (sourceId) {
    await db
      .update(crawlerSourcesTable)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: "ok",
        lastRunCount: stored,
        updatedAt: new Date(),
      })
      .where(eq(crawlerSourcesTable.id, sourceId));
  }
}

export async function failRun(runId: string, sourceId: string | undefined, errorMessage: string): Promise<void> {
  await db
    .update(collectionRunsTable)
    .set({ status: "failed", errorMessage, completedAt: new Date() })
    .where(eq(collectionRunsTable.id, runId));

  if (sourceId) {
    await db
      .update(crawlerSourcesTable)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: "error",
        errorCount: sql`${crawlerSourcesTable.errorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(crawlerSourcesTable.id, sourceId));
  }

  logger.warn({ runId, sourceId }, errorMessage);
}
