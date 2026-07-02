import { createWorker } from "./queues";
import { db } from "@workspace/db";
import { alertsTable, organizationsTable, usersTable, emailPreferencesTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getQueues } from "./queues";
import { detectSpikesForOrg } from "./spikeDetector";
import { dispatchWebhookEvent } from "./webhookDispatcher";
import { sendTelegramMessage } from "./telegramBot";
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
 * 2. "alert-dispatch"  → deliver an existing alert to org members via:
 *    - Email (Resend)
 *    - Slack incoming webhook
 *    - Microsoft Teams incoming webhook
 *    - Telegram bot
 *    - Registered THEA webhooks (HMAC-signed)
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

    const { alertId, orgId, keyword, severity, spikeRatio, crisisProbability } = job.data as AlertDispatchJobData;
    if (!alertId) {
      logger.warn({ jobId: job.id }, "alert-dispatch job missing alertId — skipping");
      return;
    }

    await db
      .update(alertsTable)
      .set({ status: "dispatched" })
      .where(and(eq(alertsTable.id, alertId), eq(alertsTable.orgId, orgId)));

    try {
      const [orgMembers, org, emailPref] = await Promise.all([
        db
          .select({ email: usersTable.email, name: usersTable.name, role: usersTable.role })
          .from(usersTable)
          .where(and(eq(usersTable.orgId, orgId), inArray(usersTable.role, ["owner", "admin"]))),
        db
          .select({ name: organizationsTable.name, notificationConfig: organizationsTable.notificationConfig })
          .from(organizationsTable)
          .where(eq(organizationsTable.id, orgId))
          .then((rows) => rows[0]),
        db
          .select()
          .from(emailPreferencesTable)
          .where(eq(emailPreferencesTable.orgId, orgId))
          .then((rows) => rows[0] ?? null),
      ]);

      const severityEmoji = severity === "critical" ? "🚨" : severity === "high" ? "⚠️" : "📊";
      const alertUrl = `${process.env["APP_URL"] ?? "https://app.thea.ai"}/alerts/${alertId}`;

      // ── Email delivery ─────────────────────────────────────────────────────
      if (orgMembers.length > 0) {
        await getQueues().emailDelivery.add(
          "alert-email",
          {
            to: orgMembers.map((r) => ({ email: r.email, name: r.name ?? r.email })),
            subject: `${severityEmoji} THEA Alert [${(severity ?? "medium").toUpperCase()}]: Spike on "${keyword}"`,
            template: "spike-alert",
            data: {
              orgName: org?.name ?? "Your Organisation",
              keyword,
              severity,
              spikeRatio: spikeRatio ? spikeRatio.toFixed(1) + "×" : "N/A",
              crisisProbability: crisisProbability ? `${crisisProbability}%` : "N/A",
              dashboardUrl: alertUrl,
            },
          },
          { priority: severity === "critical" ? 1 : 3 },
        );
        logger.info({ alertId, orgId, keyword, severity, recipients: orgMembers.length }, "Alert email queued");
      }

      // ── Slack delivery ─────────────────────────────────────────────────────
      const notifConfig = org?.notificationConfig ?? {};
      if (notifConfig.slackEnabled && notifConfig.slackWebhookUrl) {
        const allowedSlackHost = "hooks.slack.com";
        let slackUrlSafe = false;
        try {
          const parsed = new URL(notifConfig.slackWebhookUrl);
          slackUrlSafe = parsed.protocol === "https:" && parsed.hostname === allowedSlackHost;
        } catch { /* invalid URL */ }

        if (!slackUrlSafe) {
          logger.warn({ alertId, orgId }, "Slack webhook URL failed allowlist check — skipping");
        } else {
          try {
            const body = JSON.stringify({
              text: `${severityEmoji} *THEA Alert [${(severity ?? "medium").toUpperCase()}]* — spike on *${keyword}*`,
              attachments: [
                {
                  color: severity === "critical" ? "#e53e3e" : severity === "high" ? "#dd6b20" : "#3182ce",
                  fields: [
                    { title: "Spike ratio", value: spikeRatio ? `${spikeRatio.toFixed(1)}×` : "N/A", short: true },
                    { title: "Crisis probability", value: crisisProbability ? `${crisisProbability}%` : "N/A", short: true },
                    { title: "Organisation", value: org?.name ?? orgId, short: true },
                  ],
                  footer: "THEA Intelligence",
                },
              ],
            });
            await fetch(notifConfig.slackWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5000) });
            logger.info({ alertId, orgId }, "Slack alert delivered");
          } catch (err) {
            logger.warn({ err, alertId, orgId }, "Slack delivery failed");
          }
        }
      }

      // ── Microsoft Teams delivery ────────────────────────────────────────────
      const teamsUrl = emailPref?.teamsWebhookUrl;
      if (teamsUrl) {
        let teamsUrlSafe = false;
        try {
          const parsed = new URL(teamsUrl);
          teamsUrlSafe = parsed.protocol === "https:" && parsed.hostname.endsWith(".webhook.office.com");
        } catch { /* invalid URL */ }

        if (!teamsUrlSafe) {
          logger.warn({ alertId, orgId }, "Teams webhook URL failed allowlist check — skipping");
        } else {
          try {
            const teamsCard = JSON.stringify({
              "@type": "MessageCard",
              "@context": "http://schema.org/extensions",
              themeColor: severity === "critical" ? "e53e3e" : severity === "high" ? "dd6b20" : "3182ce",
              summary: `THEA Alert: spike on "${keyword}"`,
              sections: [
                {
                  activityTitle: `${severityEmoji} THEA Alert [${(severity ?? "medium").toUpperCase()}]`,
                  activitySubtitle: org?.name ?? orgId,
                  facts: [
                    { name: "Keyword", value: keyword ?? "N/A" },
                    { name: "Spike ratio", value: spikeRatio ? `${spikeRatio.toFixed(1)}×` : "N/A" },
                    { name: "Crisis probability", value: crisisProbability ? `${crisisProbability}%` : "N/A" },
                    { name: "Severity", value: (severity ?? "medium").toUpperCase() },
                  ],
                },
              ],
              potentialAction: [{ "@type": "OpenUri", name: "View in Dashboard", targets: [{ os: "default", uri: alertUrl }] }],
            });
            await fetch(teamsUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: teamsCard, signal: AbortSignal.timeout(5000) });
            logger.info({ alertId, orgId }, "Teams alert delivered");
          } catch (err) {
            logger.warn({ err, alertId, orgId }, "Teams delivery failed");
          }
        }
      }

      // ── Telegram delivery ───────────────────────────────────────────────────
      const telegramChatId = emailPref?.telegramChatId;
      if (telegramChatId) {
        const message = [
          `${severityEmoji} *THEA Alert* \\[${(severity ?? "medium").toUpperCase()}\\]`,
          `Keyword: *${keyword ?? "N/A"}*`,
          `Spike ratio: ${spikeRatio ? spikeRatio.toFixed(1) + "×" : "N/A"} | Crisis: ${crisisProbability ? crisisProbability + "%" : "N/A"}`,
          `[View in Dashboard](${alertUrl})`,
        ].join("\n");
        await sendTelegramMessage(telegramChatId, message);
        logger.info({ alertId, orgId, telegramChatId }, "Telegram alert delivered");
      }

      // ── WhatsApp Business Cloud API delivery ───────────────────────────────
      const whatsappTo = emailPref?.whatsappPhoneNumber;
      const whatsappPhoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
      const whatsappAccessToken = process.env["WHATSAPP_ACCESS_TOKEN"];
      if (whatsappTo && whatsappPhoneNumberId && whatsappAccessToken) {
        try {
          const body = JSON.stringify({
            messaging_product: "whatsapp",
            to: whatsappTo,
            type: "template",
            template: {
              name: "thea_spike_alert",
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: keyword ?? "N/A" },
                    { type: "text", text: (severity ?? "medium").toUpperCase() },
                    { type: "text", text: spikeRatio ? `${spikeRatio.toFixed(1)}×` : "N/A" },
                  ],
                },
              ],
            },
          });
          const resp = await fetch(
            `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${whatsappAccessToken}`,
                "Content-Type": "application/json",
              },
              body,
              signal: AbortSignal.timeout(5000),
            },
          );
          if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            logger.warn({ alertId, orgId, status: resp.status, errText }, "WhatsApp delivery returned non-OK status");
          } else {
            logger.info({ alertId, orgId }, "WhatsApp alert delivered");
          }
        } catch (err) {
          logger.warn({ err, alertId, orgId }, "WhatsApp delivery failed");
        }
      } else if (whatsappTo && (!whatsappPhoneNumberId || !whatsappAccessToken)) {
        logger.warn({ alertId, orgId }, "WhatsApp recipient configured but WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN missing — skipping");
      }

      // ── Registered webhooks (HMAC-signed) ──────────────────────────────────
      dispatchWebhookEvent(orgId, "alert.spike", {
        alertId,
        keyword,
        severity,
        spikeRatio,
        crisisProbability,
      }).catch((err) => logger.warn({ err, alertId, orgId }, "Webhook dispatch failed (non-blocking)"));
    } catch (err) {
      logger.warn({ err, alertId, orgId }, "Failed to queue alert notifications — alert still marked dispatched");
    }
  });
}
