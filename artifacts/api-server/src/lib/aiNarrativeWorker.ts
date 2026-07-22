/**
 * AI Narrative Monitor — queue worker + scheduler.
 *
 * An hourly "ai-narrative-tick" job finds orgs due for a scheduled run
 * (active pro/enterprise subscription, not paused, cadence elapsed) and
 * enqueues one "ai-narrative-run" job per org on the same dedicated queue
 * (concurrency 1, so runs execute sequentially and cannot starve the
 * intelligence-jobs queue).
 */
import { createWorker, getQueues } from "./queues";
import { runNarrativeMonitor, findDueOrgs, failStaleNarrativeRuns } from "./aiNarrative";
import { logger } from "./logger";

interface AiNarrativeJobData {
  orgId?: string;
  trigger?: "scheduled" | "manual";
}

export function startAiNarrativeWorker(): void {
  createWorker<AiNarrativeJobData>("ai-narrative", async (job) => {
    if (job.name === "ai-narrative-tick") {
      // Sweep runs stuck in "running" (crashed process) so they can't block
      // manual runs or the portal "Run now" button forever.
      await failStaleNarrativeRuns().catch((err) => {
        logger.warn({ err }, "Failed to sweep stale AI narrative runs");
      });
      const due = await findDueOrgs();
      if (!due.length) return;
      logger.info({ orgs: due.length }, "AI narrative tick — scheduling due org runs");
      const queue = getQueues().aiNarrative;
      for (const { orgId } of due) {
        // Same deterministic jobId as manual runs — a scheduled enqueue is a
        // no-op if a run for this org is already waiting/active (and vice
        // versa), so an org can never have two runs queued back-to-back.
        await queue.add(
          "ai-narrative-run",
          { orgId, trigger: "scheduled" },
          { jobId: `ai-narrative-run-${orgId}`, removeOnComplete: true, removeOnFail: true },
        );
      }
      return;
    }

    const { orgId, trigger } = job.data;
    if (!orgId) {
      logger.warn({ jobId: job.id }, "ai-narrative-run job missing orgId — skipping");
      return;
    }
    await runNarrativeMonitor(orgId, trigger ?? "scheduled");
  });
}

export async function scheduleAiNarrative(): Promise<void> {
  const queue = getQueues().aiNarrative;
  await queue.upsertJobScheduler(
    "ai-narrative-tick",
    { every: 60 * 60 * 1000 }, // hourly — tick itself decides which orgs are due
    { name: "ai-narrative-tick", data: {} },
  );
  logger.info("AI narrative tick scheduled (hourly)");
}
