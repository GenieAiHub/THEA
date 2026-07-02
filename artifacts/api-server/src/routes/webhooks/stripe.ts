import { type Request, type Response } from "express";
import Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
  handleStripeSubscriptionUpsert,
  handleStripeSubscriptionDeleted,
  handleStripeInvoicePaymentFailed,
} from "../../lib/stripe";
import { logger } from "../../lib/logger";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  let stripe: Stripe;
  let webhookSecret: string;

  try {
    stripe = await getStripeClient();
    webhookSecret = await getStripeWebhookSecret();
  } catch (err) {
    logger.warn("Stripe webhook received but Stripe is not configured — ignoring");
    res.json({ received: true });
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Webhook signature invalid" });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await handleStripeSubscriptionUpsert(sub, customerId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await handleStripeSubscriptionDeleted(customerId);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer)?.id;
        if (customerId) await handleStripeInvoicePaymentFailed(customerId);
        break;
      }
      default:
        logger.debug({ type: event.type }, "Stripe webhook event ignored");
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Stripe webhook handler error");
    res.status(500).json({ error: "Webhook handler failed" });
    return;
  }

  res.json({ received: true });
}
