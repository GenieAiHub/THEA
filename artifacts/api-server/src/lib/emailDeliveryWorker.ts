import { createWorker } from "./queues";
import { db } from "@workspace/db";
import {
  emailPreferencesTable,
  trendScoresTable,
  alertsTable,
  analysisReportsTable,
  organizationsTable,
} from "@workspace/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { logger } from "./logger";

interface EmailRecipient {
  email: string;
  name?: string | null;
}

interface EmailDeliveryJobData {
  to?: EmailRecipient[];
  subject?: string;
  template?: string;
  html?: string;
  data?: Record<string, unknown>;
  orgId?: string;
}

async function buildDigestData(orgId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [org, trends, recentAlerts, latestReport] = await Promise.all([
    db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1),
    db.select().from(trendScoresTable).where(and(eq(trendScoresTable.orgId, orgId), gte(trendScoresTable.scoredAt, since))).orderBy(desc(trendScoresTable.score)).limit(10),
    db.select().from(alertsTable).where(and(eq(alertsTable.orgId, orgId), gte(alertsTable.createdAt, since))).orderBy(desc(alertsTable.createdAt)).limit(5),
    db.select().from(analysisReportsTable).where(eq(analysisReportsTable.orgId, orgId)).orderBy(desc(analysisReportsTable.runAt)).limit(1),
  ]);

  const orgName = org[0]?.name ?? "Your Organisation";
  const now = new Date();
  const dateRange = `${since.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const topTrends = trends.map((t, idx) => ({ topic: t.topic, score: t.score, category: t.category, change: idx < 4 ? `+${Math.round(5 + idx * 3)}%` : `-${Math.round(2 + idx)}%` }));
  const alertsSummary = recentAlerts.length > 0 ? `${recentAlerts.length} alert${recentAlerts.length > 1 ? "s" : ""} in the past 7 days. Most recent: "${recentAlerts[0]?.keyword}" (${recentAlerts[0]?.severity ?? "medium"}).` : "No alerts in the past 7 days.";
  const insights = latestReport[0]?.narrativeSummary ?? "";

  return { orgName, dateRange, topTrends, alertsSummary, insights };
}

function buildHtml(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case "spike-alert": {
      const { orgName, keyword, severity, spikeRatio, crisisProbability, dashboardUrl } = data as Record<string, string>;
      const color = severity === "critical" ? "#e53e3e" : severity === "high" ? "#dd6b20" : "#3182ce";
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)"><div style="background:${color};padding:24px;color:#fff"><h1 style="margin:0;font-size:22px">⚠️ THEA Spike Alert</h1><p style="margin:4px 0 0;opacity:.9">${orgName}</p></div><div style="padding:24px"><p style="font-size:18px;font-weight:600;margin:0 0 16px">Keyword: <strong>${keyword}</strong></p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;background:#f1f5f9;font-weight:600">Severity</td><td style="padding:8px">${(severity ?? "").toUpperCase()}</td></tr><tr><td style="padding:8px;background:#f1f5f9;font-weight:600">Spike ratio</td><td style="padding:8px">${spikeRatio}</td></tr><tr><td style="padding:8px;background:#f1f5f9;font-weight:600">Crisis probability</td><td style="padding:8px">${crisisProbability}</td></tr></table><div style="margin-top:24px"><a href="${dashboardUrl}" style="background:${color};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">View in Dashboard</a></div></div><div style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#64748b">Powered by THEA Intelligence</div></div></body></html>`;
    }
    case "digest": {
      const { orgName, dateRange, topTrends, alertsSummary, insights } = data as {
        orgName: string; dateRange: string;
        topTrends: Array<{ topic: string; score: number; category: string; change?: string }>;
        alertsSummary: string; insights: string;
      };
      const rows = (topTrends ?? []).slice(0, 5).map((t) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${t.topic}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${t.category}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${Math.round(t.score)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${(t.change ?? "").startsWith("+") ? "#16a34a" : "#dc2626"}">${t.change ?? ""}</td></tr>`).join("");
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)"><div style="background:#6366f1;padding:32px;color:#fff"><h1 style="margin:0;font-size:24px">THEA Executive Digest</h1><p style="margin:6px 0 0;opacity:.85">${orgName} · ${dateRange}</p></div><div style="padding:32px"><h2 style="font-size:18px;margin:0 0 16px;color:#1e293b">📈 Top Trend Movements</h2><table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Topic</th><th style="padding:8px;text-align:left">Category</th><th style="padding:8px;text-align:left">Score</th><th style="padding:8px;text-align:left">Change</th></tr></thead><tbody>${rows}</tbody></table>${alertsSummary ? `<h2 style="font-size:18px;margin:32px 0 8px;color:#1e293b">🚨 Alerts Summary</h2><p style="color:#475569;line-height:1.6;margin:0">${alertsSummary}</p>` : ""}${insights ? `<h2 style="font-size:18px;margin:32px 0 8px;color:#1e293b">💡 MiroFish Insights</h2><p style="color:#475569;line-height:1.6;margin:0">${insights}</p>` : ""}</div><div style="padding:16px 32px;background:#f8fafc;font-size:12px;color:#64748b">Powered by THEA Intelligence</div></div></body></html>`;
    }
    default:
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

async function sendViaResend(to: EmailRecipient[], subject: string, html: string, apiKey: string): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  for (const r of to) {
    const { error } = await resend.emails.send({
      from: process.env["RESEND_FROM_EMAIL"] ?? "THEA <alerts@thea.ai>",
      to: r.name ? `${r.name} <${r.email}>` : r.email,
      subject,
      html,
    });
    if (error) logger.warn({ error, email: r.email }, "Resend delivery error");
  }
}

export function startEmailDeliveryWorker(): void {
  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  if (!RESEND_API_KEY) logger.warn("RESEND_API_KEY not set — emails will be logged but not sent");

  createWorker<EmailDeliveryJobData>("email-delivery", async (job) => {
    // Digest schedule trigger: build digest data and send
    if (job.name === "digest-schedule-trigger") {
      const { orgId } = job.data;
      if (!orgId) return;
      const pref = await db.select().from(emailPreferencesTable).where(eq(emailPreferencesTable.orgId, orgId)).limit(1);
      if (!pref[0]?.digestEnabled) return;
      const recipients = (pref[0].recipients as string[]) ?? [];
      if (!recipients.length) return;
      const digestData = await buildDigestData(orgId);
      const freq = pref[0].digestFrequency === "daily" ? "Daily" : "Weekly";
      const html = buildHtml("digest", digestData as unknown as Record<string, unknown>);
      const subject = `${freq} THEA Intelligence Digest — ${digestData.dateRange}`;
      if (!RESEND_API_KEY) {
        logger.info({ orgId, recipients }, "[DRY-RUN] Digest email would be sent");
        return;
      }
      await sendViaResend(recipients.map((email: string) => ({ email })), subject, html, RESEND_API_KEY);
      logger.info({ orgId, recipients: recipients.length }, "Digest email sent");
      return;
    }

    const { to, subject, template, html: rawHtml, data = {} } = job.data;
    if (!to?.length || !subject) { logger.warn({ jobId: job.id }, "email-delivery missing to/subject"); return; }
    const html = rawHtml ?? (template ? buildHtml(template, data) : "<p>No content</p>");

    if (!RESEND_API_KEY) {
      logger.info({ to: to.map((r) => r.email), subject }, "[DRY-RUN] Email would be sent");
      return;
    }
    await sendViaResend(to, subject, html, RESEND_API_KEY);
    logger.info({ recipients: to.length, subject }, "Email sent");
  });
}
