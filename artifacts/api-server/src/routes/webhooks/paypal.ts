import { type Request, type Response } from "express";
import { verifyPaypalWebhook } from "../../lib/paypal";
import { activateSubscription } from "../../lib/subscriptionService";
import { PLAN_TO_TIER, amountForPlan, isPlanKey, type BillingInterval } from "../../lib/plans";
import { logger } from "../../lib/logger";

/**
 * PayPal webhook — reconciliation only. The authoritative tier grant happens
 * synchronously in POST /billing/paypal/capture. This exists so a completed
 * capture still lands even if the client never received the capture response.
 * activateSubscription() is idempotent (UNIQUE provider+capture id), so a
 * double-fire is a safe no-op.
 */
export async function handlePaypalWebhook(req: Request, res: Response): Promise<void> {
  let verified = false;
  try {
    verified = await verifyPaypalWebhook({ headers: req.headers, body: req.body });
  } catch (err) {
    logger.warn({ err }, "PayPal webhook verification threw");
  }
  if (!verified) {
    res.status(400).json({ error: "Webhook verification failed" });
    return;
  }

  const event = req.body as { event_type?: string; resource?: Record<string, any> };
  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const cap = event.resource ?? {};
      const captureId: string | undefined = cap.id;
      const customId: string | undefined = cap.custom_id;
      const amountValue: string = cap.amount?.value ?? "";
      const currency: string = cap.amount?.currency_code ?? "";

      if (captureId && customId) {
        let parsed: { orgId?: string; planKey?: string; interval?: string } = {};
        try {
          parsed = JSON.parse(customId);
        } catch {
          logger.warn({ captureId }, "PayPal webhook: unparseable custom_id");
        }
        if (parsed.orgId && parsed.planKey && isPlanKey(parsed.planKey)) {
          const interval: BillingInterval = parsed.interval === "annual" ? "annual" : "monthly";
          const expected = amountForPlan(parsed.planKey, interval).toFixed(2);
          if (currency === "USD" && amountValue === expected) {
            const tier = PLAN_TO_TIER[parsed.planKey];
            const periodEnd = new Date();
            if (interval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            else periodEnd.setMonth(periodEnd.getMonth() + 1);
            await activateSubscription({
              orgId: parsed.orgId,
              tier,
              provider: "paypal",
              providerRef: captureId,
              planKey: parsed.planKey,
              interval,
              amount: amountValue,
              currency,
              periodEnd,
              metadata: { source: "webhook" },
            });
          } else {
            logger.warn({ captureId, amountValue, expected }, "PayPal webhook amount mismatch — ignoring");
          }
        }
      }
    } else {
      logger.debug({ type: event.event_type }, "PayPal webhook event ignored");
    }
  } catch (err) {
    logger.error({ err }, "PayPal webhook handler error");
  }

  res.json({ received: true });
}
