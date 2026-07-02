import { logger } from "./logger";

/**
 * Minimal PayPal REST client (Orders v2) using direct fetch — no SDK dependency.
 *
 * THEA charges PayPal as a single up-front payment per billing cycle (not a
 * PayPal Billing Subscription): the server creates an order, the customer
 * approves it, then the server captures it and grants the tier through
 * activateSubscription(). resolveOrgContext() fail-closes the fixed window at
 * currentPeriodEnd, so no recurring PayPal machinery is needed.
 */

const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();

function apiBase(): string {
  return PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not configured");

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface CreateOrderArgs {
  orgId: string;
  planKey: string;
  interval: string;
  /** Whole-USD amount for one billing cycle. */
  amount: number;
}

/** Create a CAPTURE order and return its PayPal order id. */
export async function createPaypalOrder(args: CreateOrderArgs): Promise<string> {
  const token = await getAccessToken();
  // custom_id binds the order to the org + plan server-side; the client cannot
  // alter it, and we re-verify the captured amount against it on capture.
  const customId = JSON.stringify({ orgId: args.orgId, planKey: args.planKey, interval: args.interval });

  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: args.amount.toFixed(2) },
          custom_id: customId,
          description: `THEA ${args.planKey} (${args.interval})`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

export interface CaptureResult {
  captureId: string;
  status: string;
  amountValue: string;
  currency: string;
  customId: string | null;
}

/** Capture a previously-approved order and normalize the result. */
export async function capturePaypalOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    status?: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: { captures?: Array<{ id?: string; status?: string; custom_id?: string; amount?: { value?: string; currency_code?: string } }> };
    }>;
  };
  const pu = json.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  return {
    captureId: cap?.id ?? "",
    status: cap?.status ?? json.status ?? "",
    amountValue: cap?.amount?.value ?? "",
    currency: cap?.amount?.currency_code ?? "",
    customId: cap?.custom_id ?? pu?.custom_id ?? null,
  };
}

export interface WebhookVerifyArgs {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

/** Verify a webhook payload with PayPal's verify-webhook-signature API. */
export async function verifyPaypalWebhook(args: WebhookVerifyArgs): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const h = args.headers;
  const pick = (k: string): string | undefined => {
    const v = h[k];
    return Array.isArray(v) ? v[0] : v;
  };
  try {
    const token = await getAccessToken();
    const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: pick("paypal-auth-algo"),
        cert_url: pick("paypal-cert-url"),
        transmission_id: pick("paypal-transmission-id"),
        transmission_sig: pick("paypal-transmission-sig"),
        transmission_time: pick("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: args.body,
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { verification_status: string };
    return json.verification_status === "SUCCESS";
  } catch (err) {
    logger.warn({ err }, "PayPal webhook verification request failed");
    return false;
  }
}
