import { createWorker } from "../queues";
import { buildSeedDocument } from "./seed-builder";
import { runMiroFishAnalysis } from "./mirofish";
import { parseStructuredReport } from "./report-parser";
import { scoreTrends } from "./trend-scorer";
import { aggregateEntityMentions } from "./entity-tracker";
import { db } from "@workspace/db";
import { analysisReportsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export interface MiroFishJobData {
  category: string;
  windowHours?: number;
  forceRun?: boolean;
  triggeredBy?: "scheduler" | "manual";
}

export function startMiroFishWorker(): void {
  createWorker<MiroFishJobData>("mirofish-runs", async (job) => {
    const { category, windowHours = 24, triggeredBy = "scheduler" } = job.data;
    const runStart = new Date();

    logger.info({ category, windowHours, triggeredBy }, "MiroFish analysis run started");

    const [reportRow] = await db
      .insert(analysisReportsTable)
      .values({ category, status: "running", runAt: runStart })
      .returning({ id: analysisReportsTable.id });

    const reportId = reportRow!.id;

    try {
      const { document: seedDocument, itemCount } = await buildSeedDocument(category, windowHours);

      if (itemCount === 0) {
        await db
          .update(analysisReportsTable)
          .set({
            status: "completed",
            narrativeSummary: `No content available for ${category} in the last ${windowHours} hours.`,
            itemsAnalyzed: 0,
            completedAt: new Date(),
          })
          .where(eq(analysisReportsTable.id, reportId));

        logger.warn({ category, windowHours }, "No items for MiroFish seed — skipping analysis");
        return;
      }

      const { runId, report } = await runMiroFishAnalysis(seedDocument, category);
      const parsed = parseStructuredReport(report);

      await db
        .update(analysisReportsTable)
        .set({
          miroFishRunId: runId,
          status: "completed",
          trendingTopics: parsed.trendingTopics,
          narrativeSummary: parsed.narrativeSummary,
          sentimentOverall: parsed.sentimentOverall,
          keyEntities: parsed.keyEntities,
          predictions: parsed.predictions,
          rawReport: JSON.stringify(report),
          seedDocumentLength: seedDocument.length,
          itemsAnalyzed: itemCount,
          completedAt: new Date(),
        })
        .where(eq(analysisReportsTable.id, reportId));

      await scoreTrends(parsed, category, itemCount);

      const windowEnd = new Date();
      const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60 * 1000);
      await aggregateEntityMentions(windowStart, windowEnd, category);

      logger.info(
        { category, runId, topics: parsed.trendingTopics.length, itemCount },
        "MiroFish analysis run complete"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, category, reportId }, "MiroFish analysis run failed");

      await db
        .update(analysisReportsTable)
        .set({ status: "failed", narrativeSummary: `Run failed: ${msg}`, completedAt: new Date() })
        .where(eq(analysisReportsTable.id, reportId))
        .catch(() => void 0);

      throw err;
    }
  });
}
