/**
 * Intelligence background job worker.
 *
 * Processes jobs added to the "llm-processing" queue by the intelligence scheduler:
 *   - journalist-scan
 *   - newsjacking-detect
 *   - campaign-measure
 *   - competitive-briefing
 *
 * NOTE: This worker co-exists with the LLM processing worker (analysis/llm-worker.ts).
 * The job discriminator is the `job` field in job.data.
 * Jobs without a known `job` key are passed through (not consumed here).
 */
import { createWorker } from "../queues";
import { runJournalistScanAllOrgs } from "../journalistTracker";
import { detectNewsjackingOpportunities } from "../newsjackingDetector";
import { measureAllActiveCampaigns } from "../campaignTracker";
import { runWeeklyCompetitiveBriefings } from "../competitiveNarrativeBriefing";
import { db } from "@workspace/db";
import { organizationsTable } from "@workspace/db/schema";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../logger";

export function startIntelligenceWorker(): void {
  createWorker<{ job?: string; orgId?: string }>(
    "intelligence-jobs",
    async (bullJob) => {
      const { job: jobType, orgId } = bullJob.data;

      switch (jobType) {
        case "journalist-scan": {
          logger.info("Running journalist scan for all orgs");
          await runJournalistScanAllOrgs();
          break;
        }

        case "newsjacking-detect": {
          logger.info("Running newsjacking detection for all orgs");
          const orgs = await db
            .select({ id: organizationsTable.id })
            .from(organizationsTable)
            .where(isNull(organizationsTable.pausedAt));

          await Promise.allSettled(
            orgs.map((o) =>
              detectNewsjackingOpportunities(o.id).catch((err) =>
                logger.warn({ err, orgId: o.id }, "Newsjacking detection failed for org"),
              ),
            ),
          );
          break;
        }

        case "campaign-measure": {
          logger.info("Running daily campaign measurements");
          await measureAllActiveCampaigns();
          break;
        }

        case "competitive-briefing": {
          logger.info("Running weekly competitive narrative briefings");
          await runWeeklyCompetitiveBriefings();
          break;
        }

        default:
          // Not an intelligence job — pass to other logic (should not happen in this queue slot)
          logger.debug({ jobType, jobId: bullJob.id }, "Intelligence worker: unknown job type, skipping");
      }
    },
    { concurrency: 1 }, // intelligence jobs run sequentially to avoid LLM rate limits
  );

  logger.info("Intelligence background worker started");
}
