import { createWorker } from "./queues";
import { db } from "@workspace/db";
import { alertsTable, organizationsTable, usersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getQueues } from "./queues";
import { detectSpikesForOrg } from "./spikeDetector";
import { logger } from "./logger";

interface AlertDispatchJobData {
  alertId?: string;
  orgId: string;
  keyword?: string;
  severity?: string;
  spikeRatio?: number;
  crisisProbability?: number;
}

interface SpikeAnalysisJobData {
  orgId: string;
}

/**
 * Alert dispatch worker — handles two job types on the alert-dispatch queue:
 *
 * 1. "spike-analysis"  → run spike detection for a single org (called by scheduler)
 * 2. "alert-dispatch"  → deliver an existing alert to org members via email
 */
export function startAlertDispatchWorker(): void {
  createWorker<AlertDispatchJobData | SpikeAnalysisJobData>("alert-dispatch", async (job) => {
    if (job.name === "spike-analysis") {
      const { orgId } = job.data as SpikeAnalysisJobData;
      logger.info({ orgId, jobId: job.id }, "Spike analysis job started");
      await detectSpikesForOrg(orgId);
      logger.info({ orgId }, "Spike analysis job complete");
      return;
    }

    // alert-dispatch: deliver the alert via email
    const { alertId, orgId, keyword, severity, spikeRatio, crisisProbability } = job.data as AlertDispatchJobData;
    if (!alertId) {
      logger.warn({ jobId: job.id }, "alert-dispatch job missing alertId — skipping");
      return;
    }

    // Mark alert as dispatched
    await db
      .update(alertsTable)
      .set({ status: "dispatched" })
      .where(and(eq(alertsTable.id, alertId), eq(alertsTable.orgId, orgId)));

    // Queue email delivery to org admins/owners
    try {
      const orgMembers = await db
        .select({
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.orgId, orgId),
            inArray(usersTable.role, ["owner", "admin"]),
          ),
        );

      const recipients = orgMembers;

      if (!recipients.length) {
        logger.info({ orgId, alertId }, "No active admin/owner recipients for alert email");
        return;
      }

      const org = await db
        .select({ name: organizationsTable.name })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, orgId))
        .then((rows) => rows[0]);

      const severityEmoji = severity === "critical" ? "🚨" : severity === "high" ? "⚠️" : "📊";

      await getQueues().emailDelivery.add(
        "alert-email",
        {
          to: recipients.map((r) => ({ email: r.email, name: r.name ?? r.email })),
          subject: `${severityEmoji} THEA Alert [${(severity ?? "medium").toUpperCase()}]: Spike on "${keyword}"`,
          template: "spike-alert",
          data: {
            orgName: org?.name ?? "Your Organisation",
            keyword,
            severity,
            spikeRatio: spikeRatio ? spikeRatio.toFixed(1) + "×" : "N/A",
            crisisProbability: crisisProbability ? `${crisisProbability}%` : "N/A",
            dashboardUrl: `${process.env["APP_URL"] ?? "https://app.thea.ai"}/alerts/${alertId}`,
          },
        },
        { priority: severity === "critical" ? 1 : 3 },
      );

      logger.info({ alertId, orgId, keyword, severity, recipients: recipients.length }, "Alert email queued");
    } catch (err) {
      logger.warn({ err, alertId, orgId }, "Failed to queue alert email — alert still marked dispatched");
    }
  });
}
