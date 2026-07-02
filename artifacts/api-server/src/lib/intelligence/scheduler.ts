/**
 * Intelligence background job schedulers.
 *
 * Registered once at server startup — idempotent via upsertJobScheduler.
 *
 * Jobs:
 *  - journalist-scan          daily  @ 06:00 UTC
 *  - newsjacking-detect       every  2h
 *  - campaign-measure-daily   daily  @ 07:00 UTC
 *  - competitive-briefing     weekly @ Monday 08:00 UTC
 */
import { getQueues } from "../queues";
import { logger } from "../logger";

const MS_2H    = 2  * 60 * 60 * 1000;
const MS_24H   = 24 * 60 * 60 * 1000;
const MS_7D    = 7  * 24 * 60 * 60 * 1000;

export async function scheduleIntelligenceJobs(): Promise<void> {
  try {
    const { intelligenceJobs } = getQueues();

    // Daily journalist scan — 06:00 UTC
    await intelligenceJobs.upsertJobScheduler(
      "journalist-scan-daily",
      { every: MS_24H, startDate: nextUtcHour(6) },
      {
        name: "journalist-scan",
        data: { job: "journalist-scan" },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 30_000 } },
      },
    );

    // Newsjacking detection — every 2h
    await intelligenceJobs.upsertJobScheduler(
      "newsjacking-detect-2h",
      { every: MS_2H },
      {
        name: "newsjacking-detect",
        data: { job: "newsjacking-detect" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 15_000 } },
      },
    );

    // Daily campaign measurements — 07:00 UTC
    await intelligenceJobs.upsertJobScheduler(
      "campaign-measure-daily",
      { every: MS_24H, startDate: nextUtcHour(7) },
      {
        name: "campaign-measure",
        data: { job: "campaign-measure" },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 30_000 } },
      },
    );

    // Weekly competitive briefing — 08:00 UTC every Monday
    await intelligenceJobs.upsertJobScheduler(
      "competitive-briefing-weekly",
      { every: MS_7D, startDate: nextMonday8amUtc() },
      {
        name: "competitive-briefing",
        data: { job: "competitive-briefing" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
      },
    );

    logger.info("Intelligence schedulers registered");
  } catch (err) {
    logger.warn({ err }, "Failed to register intelligence schedulers — will retry on next startup");
  }
}

function nextUtcHour(hour: number): Date {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function nextMonday8amUtc(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 8, 0, 0, 0));
  return next;
}
