import { createHmac } from "node:crypto";
import { db } from "@workspace/db";
import { webhookRegistrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const VALID_EVENTS = ["alert.spike", "analysis.complete", "campaign.milestone"] as const;
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
 * Deliver a signed webhook event to all registered URLs for the given org.
 * Each delivery is fire-and-forget with up to 3 retries (exponential backoff).
 * Call this after any qualifying event (spike alert, analysis complete, campaign milestone).
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
        const sig = signPayload(reg.secret, body);
        let lastErr: unknown;

        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
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

            await db
              .update(webhookRegistrationsTable)
              .set({ lastDeliveredAt: new Date(), failureCount: "0", updatedAt: new Date() })
              .where(eq(webhookRegistrationsTable.id, reg.id));

            logger.info({ webhookId: reg.id, orgId, event, status: resp.status }, "Webhook delivered");
            return;
          } catch (err) {
            lastErr = err;
            logger.warn({ err, webhookId: reg.id, attempt }, "Webhook delivery attempt failed");
          }
        }

        const prev = parseInt(reg.failureCount ?? "0", 10);
        await db
          .update(webhookRegistrationsTable)
          .set({ failureCount: String(prev + 1), updatedAt: new Date() })
          .where(eq(webhookRegistrationsTable.id, reg.id));

        logger.error({ webhookId: reg.id, orgId, event, err: lastErr }, "Webhook delivery exhausted retries");
      }),
  );
}
