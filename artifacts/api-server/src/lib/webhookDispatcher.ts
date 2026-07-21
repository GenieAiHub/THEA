import { createHmac } from "node:crypto";
import { db } from "@workspace/db";
import { webhookRegistrationsTable, webhookDeliveryLogsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const VALID_EVENTS = ["alert.spike", "alert.ai_narrative", "analysis.complete", "campaign.milestone", "sighting.detected"] as const;
export type WebhookEventType = (typeof VALID_EVENTS)[number];

export interface WebhookPayload {
  event: WebhookEventType;
  orgId: string;
  ts: string;
  data: Record<string, unknown>;
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * SSRF guard: reject private/internal IPs and non-HTTPS URLs.
 * Blocks: localhost, loopback, private class A/B/C, link-local, cloud metadata endpoints.
 */
function isSafeWebhookUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();

  const blocked = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "169.254.169.254", // cloud metadata (AWS/GCP/Azure)
    "metadata.google.internal",
  ];
  if (blocked.includes(host)) return false;

  // Private IPv4 CIDR ranges
  const privateIPv4 = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  ];
  if (privateIPv4.some((re) => re.test(host))) return false;

  return true;
}

async function writeDeliveryLog(
  webhookRegistrationId: string,
  orgId: string,
  event: WebhookEventType,
  targetUrl: string,
  status: "success" | "failed",
  attempt: number,
  httpStatus?: number,
  responseSnippet?: string,
): Promise<void> {
  await db.insert(webhookDeliveryLogsTable).values({
    webhookRegistrationId,
    orgId,
    event,
    targetUrl,
    status,
    httpStatus: httpStatus ?? null,
    attempt,
    responseSnippet: responseSnippet ?? null,
  }).catch((err) => logger.warn({ err }, "Failed to write webhook delivery log"));
}

/**
 * Deliver a signed webhook event to all active registered URLs for the org.
 * Per-URL: HMAC-SHA256 signed POST with X-THEA-Signature header.
 * Retries: up to 3 attempts with exponential backoff (1s, 2s, 4s).
 * Non-2xx responses are treated as delivery failures and trigger retries.
 * All attempts are persisted to webhook_delivery_logs for audit/debugging.
 */
export async function dispatchWebhookEvent(
  orgId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  let registrations;
  try {
    registrations = await db
      .select()
      .from(webhookRegistrationsTable)
      .where(and(eq(webhookRegistrationsTable.orgId, orgId), eq(webhookRegistrationsTable.isActive, true)));
  } catch (err) {
    logger.warn({ err, orgId, event }, "Failed to fetch webhook registrations");
    return;
  }

  if (!registrations.length) return;

  const payload: WebhookPayload = { event, orgId, ts: new Date().toISOString(), data };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    registrations
      .filter((r) => {
        const events = (r.events as string[]) ?? [];
        return events.length === 0 || events.includes(event);
      })
      .map(async (reg) => {
        // SSRF guard — validate target URL before sending any server-side request
        if (!isSafeWebhookUrl(reg.url)) {
          logger.warn({ webhookId: reg.id, url: reg.url, orgId }, "Webhook URL failed SSRF safety check — skipping");
          await writeDeliveryLog(reg.id, orgId, event, reg.url, "failed", 1, undefined, "SSRF_BLOCKED");
          return;
        }

        const sig = signPayload(reg.secret, body);
        let lastErr: unknown;

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (attempt > 1) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 2)));
          }
          try {
            const resp = await fetch(reg.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-THEA-Signature": `sha256=${sig}`,
                "X-THEA-Event": event,
                "User-Agent": "THEA-Webhooks/1.0",
              },
              body,
              signal: AbortSignal.timeout(10000),
            });

            if (!resp.ok) {
              const snippet = await resp.text().then((t) => t.slice(0, 200)).catch(() => "");
              await writeDeliveryLog(reg.id, orgId, event, reg.url, "failed", attempt, resp.status, snippet);
              throw new Error(`Webhook target returned ${resp.status} ${resp.statusText}`);
            }

            await Promise.all([
              db.update(webhookRegistrationsTable)
                .set({ lastDeliveredAt: new Date(), failureCount: "0", updatedAt: new Date() })
                .where(eq(webhookRegistrationsTable.id, reg.id)),
              writeDeliveryLog(reg.id, orgId, event, reg.url, "success", attempt, resp.status),
            ]);

            logger.info({ webhookId: reg.id, orgId, event, status: resp.status }, "Webhook delivered");
            return;
          } catch (err) {
            lastErr = err;
            logger.warn({ err, webhookId: reg.id, attempt }, "Webhook delivery attempt failed — will retry");
          }
        }

        // All retries exhausted
        const prev = parseInt(reg.failureCount ?? "0", 10);
        await db
          .update(webhookRegistrationsTable)
          .set({ failureCount: String(prev + 1), updatedAt: new Date() })
          .where(eq(webhookRegistrationsTable.id, reg.id));

        logger.error({ webhookId: reg.id, orgId, event, err: lastErr }, "Webhook delivery exhausted 3 retries");
      }),
  );
}
