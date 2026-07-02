import { db } from "@workspace/db";
import { emailPreferencesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getQueues } from "./queues";
import { logger } from "./logger";

/**
 * Register BullMQ repeatable digest jobs for all orgs with digest enabled.
 * When a job fires it goes to the email-delivery queue where the worker
 * builds the digest and sends the email.
 */
export async function scheduleDigests(): Promise<void> {
  try {
    const prefs = await db
      .select()
      .from(emailPreferencesTable)
      .where(eq(emailPreferencesTable.digestEnabled, true));

    if (!prefs.length) {
      logger.info("No orgs have email digest enabled — skipping digest scheduling");
      return;
    }

    const { emailDelivery } = getQueues();

    for (const pref of prefs) {
      const orgId = pref.orgId;
      const hour = parseInt(pref.digestHour ?? "7", 10);

      let cronExpr: string;
      if (pref.digestFrequency === "daily") {
        cronExpr = `0 ${hour} * * *`;
      } else {
        const dayMap: Record<string, number> = {
          monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
          friday: 5, saturday: 6, sunday: 0,
        };
        const dayNum = dayMap[pref.digestDay ?? "monday"] ?? 1;
        cronExpr = `0 ${hour} * * ${dayNum}`;
      }

      await emailDelivery.upsertJobScheduler(
        `digest-${orgId}`,
        { pattern: cronExpr, tz: "UTC" },
        {
          name: "digest-schedule-trigger",
          data: { orgId },
          opts: { priority: 5 },
        },
      );
    }

    logger.info({ count: prefs.length }, "Digest schedulers registered");
  } catch (err) {
    logger.warn({ err }, "Could not register digest schedulers");
  }
}
