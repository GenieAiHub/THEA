import { Router } from "express";
import { db } from "@workspace/db";
import { platformConfigsTable } from "@workspace/db/schema";
import { eq, asc, and, inArray, isNull } from "drizzle-orm";
import { encrypt, safeDecrypt } from "../../lib/crypto";
import { clearConfigCache } from "../../lib/llm";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Default seed config catalogue ───────────────────────────────────────────
// Every runtime setting the platform reads is listed here so an operator can
// manage it from the Super Admin UI. Values resolve DB-first with an env-var
// fallback (upper-cased key), and are cached ~5 min — so edits take effect within
// minutes without a restart. The only exception is `telegram_bot_token`, which is
// bound once when the bot launches at boot (a restart is required to re-bind).
const DEFAULT_CONFIGS: Array<{
  key: string;
  label: string;
  description: string;
  category: string;
  isSecret: boolean;
}> = [
  // ── LLM ────────────────────────────────────────────────────────────────────
  { key: "openai_api_key",                       label: "OpenAI API Key",              description: "sk-... key from platform.openai.com",              category: "llm",           isSecret: true  },
  { key: "openai_default_model",                 label: "OpenAI Default Model",        description: "e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo",            category: "llm",           isSecret: false },
  { key: "gemini_api_key",                       label: "Gemini API Key",              description: "API key from Google AI Studio",                    category: "llm",           isSecret: true  },
  { key: "gemini_default_model",                 label: "Gemini Default Model",        description: "e.g. gemini-1.5-flash, gemini-1.5-pro",            category: "llm",           isSecret: false },

  // ── News / ingestion feeds ───────────────────────────────────────────────────
  { key: "news_api_key",                         label: "NewsAPI Key",                 description: "API key from newsapi.org",                         category: "news",          isSecret: true  },
  { key: "mediastack_api_key",                   label: "Mediastack API Key",          description: "API key from mediastack.com",                      category: "news",          isSecret: true  },
  { key: "bing_news_api_key",                    label: "Bing News API Key",           description: "Azure Bing News Search key",                       category: "news",          isSecret: true  },
  { key: "youtube_api_key",                      label: "YouTube Data API Key",        description: "Google Cloud YouTube Data API v3 key",             category: "news",          isSecret: true  },
  { key: "brave_api_key",                        label: "Brave Search API Key",        description: "Default web search engine (brave.com/search/api)", category: "news",          isSecret: true  },
  { key: "serp_api_key",                         label: "SerpAPI Key",                 description: "Optional web search via serpapi.com",              category: "news",          isSecret: true  },

  // ── Social media ─────────────────────────────────────────────────────────────
  { key: "twitter_bearer_token",                 label: "Twitter Bearer Token",        description: "OAuth 2.0 bearer token for Twitter API v2",         category: "social",        isSecret: true  },
  { key: "reddit_client_id",                     label: "Reddit Client ID",            description: "Reddit app client ID",                             category: "social",        isSecret: false },
  { key: "reddit_client_secret",                 label: "Reddit Client Secret",        description: "Reddit app client secret",                         category: "social",        isSecret: true  },
  { key: "tiktok_client_key",                    label: "TikTok Client Key",           description: "TikTok developer app client key",                  category: "social",        isSecret: false },
  { key: "tiktok_client_secret",                 label: "TikTok Client Secret",        description: "TikTok developer app client secret",               category: "social",        isSecret: true  },
  { key: "telegram_bot_token",                   label: "Telegram Bot Token",          description: "BotFather token (restart required to re-bind)",     category: "social",        isSecret: true  },
  { key: "telegram_api_id",                      label: "Telegram API ID",             description: "GramJS api_id from my.telegram.org",               category: "social",        isSecret: false },
  { key: "telegram_api_hash",                    label: "Telegram API Hash",           description: "GramJS api_hash from my.telegram.org",             category: "social",        isSecret: true  },
  { key: "telegram_session",                     label: "Telegram Session String",     description: "GramJS StringSession for channel scraping",         category: "social",        isSecret: true  },
  { key: "rsshub_url",                           label: "RSSHub Base URL",             description: "RSSHub instance for Telegram fallback feeds",       category: "social",        isSecret: false },

  // ── Web crawler ──────────────────────────────────────────────────────────────
  { key: "crawler_proxy_urls",                   label: "Crawler Proxy URLs",          description: "Comma-separated proxy URLs (optional)",             category: "crawler",       isSecret: false },
  { key: "use_playwright",                       label: "Use Playwright Crawler",      description: "true = headless browser crawl, else Cheerio",       category: "crawler",       isSecret: false },

  // ── Payments (Stripe) ────────────────────────────────────────────────────────
  { key: "stripe_secret_key",                    label: "Stripe Secret Key",           description: "sk_live_... or sk_test_... from Stripe",            category: "payments",      isSecret: true  },
  { key: "stripe_webhook_secret",                label: "Stripe Webhook Secret",       description: "whsec_... endpoint signing secret",                category: "payments",      isSecret: true  },
  { key: "stripe_starter_monthly_price_id",      label: "Stripe Price — Starter Monthly",    description: "price_... for Starter monthly plan",         category: "payments",      isSecret: false },
  { key: "stripe_starter_annual_price_id",       label: "Stripe Price — Starter Annual",     description: "price_... for Starter annual plan",          category: "payments",      isSecret: false },
  { key: "stripe_pro_monthly_price_id",          label: "Stripe Price — Pro Monthly",        description: "price_... for Pro monthly plan",             category: "payments",      isSecret: false },
  { key: "stripe_pro_annual_price_id",           label: "Stripe Price — Pro Annual",         description: "price_... for Pro annual plan",              category: "payments",      isSecret: false },
  { key: "stripe_enterprise_monthly_price_id",   label: "Stripe Price — Enterprise Monthly", description: "price_... for Enterprise monthly plan",      category: "payments",      isSecret: false },
  { key: "stripe_enterprise_annual_price_id",    label: "Stripe Price — Enterprise Annual",  description: "price_... for Enterprise annual plan",       category: "payments",      isSecret: false },

  // ── Payments (PayPal) ────────────────────────────────────────────────────────
  { key: "paypal_client_id",                     label: "PayPal Client ID",            description: "REST app client ID",                               category: "payments",      isSecret: false },
  { key: "paypal_client_secret",                 label: "PayPal Client Secret",        description: "REST app client secret",                           category: "payments",      isSecret: true  },
  { key: "paypal_webhook_id",                    label: "PayPal Webhook ID",           description: "Webhook ID used for signature verification",        category: "payments",      isSecret: false },
  { key: "paypal_env",                           label: "PayPal Environment",          description: "sandbox or live",                                  category: "payments",      isSecret: false },

  // ── Payments (Crypto) ────────────────────────────────────────────────────────
  { key: "crypto_chain",                         label: "Crypto Chain",                description: "e.g. polygon, ethereum",                           category: "crypto",        isSecret: false },
  { key: "crypto_rpc_url",                        label: "Crypto RPC URL",              description: "JSON-RPC endpoint for the configured chain",        category: "crypto",        isSecret: false },
  { key: "polygon_rpc_url",                       label: "Polygon RPC URL",             description: "Polygon JSON-RPC endpoint (fallback)",             category: "crypto",        isSecret: false },
  { key: "crypto_receiving_address",             label: "Crypto Receiving Address",    description: "Native-coin receiving wallet address",             category: "crypto",        isSecret: false },
  { key: "crypto_usdt_address",                  label: "USDT Contract Address",       description: "USDT (ERC-20) token contract address",             category: "crypto",        isSecret: false },
  { key: "crypto_usdt_decimals",                 label: "USDT Decimals",               description: "Token decimals (e.g. 6)",                          category: "crypto",        isSecret: false },
  { key: "crypto_min_confirmations",             label: "Min Confirmations",           description: "Block confirmations before crediting a payment",    category: "crypto",        isSecret: false },
  { key: "crypto_intent_ttl_min",                label: "Payment Intent TTL (min)",    description: "Minutes a crypto payment intent stays valid",       category: "crypto",        isSecret: false },

  // ── Email delivery ───────────────────────────────────────────────────────────
  { key: "resend_api_key",                       label: "Resend API Key",              description: "re_... key from resend.com",                       category: "email",         isSecret: true  },
  { key: "resend_from_email",                    label: "Resend From Email",           description: "Verified sender, e.g. THEA <alerts@thea.ai>",       category: "email",         isSecret: false },

  // ── Notifications ────────────────────────────────────────────────────────────
  { key: "app_url",                              label: "App URL",                     description: "Public app base URL used in links/emails",          category: "notifications", isSecret: false },
  { key: "whatsapp_phone_number_id",             label: "WhatsApp Phone Number ID",    description: "Meta WhatsApp Cloud API phone number ID",           category: "notifications", isSecret: false },
  { key: "whatsapp_access_token",                label: "WhatsApp Access Token",       description: "Meta WhatsApp Cloud API access token",             category: "notifications", isSecret: true  },

  // ── What-If simulation (MiroFish) ────────────────────────────────────────────
  { key: "mirofish_url",                         label: "MiroFish URL",                description: "OASIS sidecar base URL (blank = GPT-only)",         category: "simulation",    isSecret: false },
  { key: "mirofish_max_rounds",                  label: "MiroFish Max Rounds",         description: "Max simulation rounds (default 10)",               category: "simulation",    isSecret: false },
  { key: "mirofish_breaker_threshold",           label: "MiroFish Breaker Threshold",  description: "Consecutive failures before failover (default 3)",  category: "simulation",    isSecret: false },
  { key: "mirofish_breaker_cooldown_ms",         label: "MiroFish Breaker Cooldown (ms)", description: "Cooldown before probing MiroFish again",         category: "simulation",    isSecret: false },

  // ── Disinformation ───────────────────────────────────────────────────────────
  { key: "claimbuster_api_key",                  label: "ClaimBuster API Key",         description: "Fact-check scoring key from idir.uta.edu/claimbuster", category: "disinformation", isSecret: true },

  // ── General platform ─────────────────────────────────────────────────────────
  { key: "platform_name",                        label: "Platform Name",               description: "Displayed in UI and emails",                       category: "general",       isSecret: false },
  { key: "support_email",                        label: "Support Email",               description: "User-facing support contact email",                category: "general",       isSecret: false },
];

// Keys from earlier revisions that have been superseded (Serper→Brave/SerpAPI,
// Bing search→Bing News, SendGrid→Resend). Removed on boot ONLY when empty, so a
// value an operator entered is never silently deleted.
const OBSOLETE_KEYS = ["serper_api_key", "bing_search_api_key", "sendgrid_api_key", "sendgrid_from_email"];

// ─── Seed defaults on first boot (idempotent) ─────────────────────────────────
export async function seedPlatformConfigs(): Promise<void> {
  try {
    const existing = await db.select({ key: platformConfigsTable.key }).from(platformConfigsTable);
    const existingKeys = new Set(existing.map((r) => r.key));

    const toInsert = DEFAULT_CONFIGS.filter((c) => !existingKeys.has(c.key)).map((c) => ({
      key:            c.key,
      encryptedValue: null,
      category:       c.category,
      label:          c.label,
      description:    c.description,
      isSecret:       c.isSecret,
      isActive:       true,
    }));

    if (toInsert.length > 0) {
      await db.insert(platformConfigsTable).values(toInsert);
      logger.info({ count: toInsert.length }, "Seeded platform config slots");
    }

    // Drop superseded slots that were never assigned a value.
    const removed = await db
      .delete(platformConfigsTable)
      .where(and(inArray(platformConfigsTable.key, OBSOLETE_KEYS), isNull(platformConfigsTable.encryptedValue)))
      .returning({ key: platformConfigsTable.key });
    if (removed.length > 0) {
      logger.info({ keys: removed.map((r) => r.key) }, "Removed obsolete platform config slots");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to seed platform configs — will retry on next boot");
  }
}

// ─── Mask helper (replaces secret values with a redacted placeholder) ─────────
function masked(row: typeof platformConfigsTable.$inferSelect) {
  const decrypted = row.isSecret ? null : safeDecrypt(row.encryptedValue);
  return {
    id:          row.id,
    key:         row.key,
    category:    row.category,
    label:       row.label,
    description: row.description,
    isSecret:    row.isSecret,
    isActive:    row.isActive,
    hasValue:    !!row.encryptedValue,
    value:       decrypted,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  };
}

// ─── GET /api/v1/admin/configs ────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  const rows = await db.select().from(platformConfigsTable).orderBy(asc(platformConfigsTable.category), asc(platformConfigsTable.key));
  res.json({ data: rows.map(masked) });
});

// ─── GET /api/v1/admin/configs/:key ──────────────────────────────────────────
router.get("/:key", async (req, res) => {
  const rows = await db.select().from(platformConfigsTable).where(eq(platformConfigsTable.key, req.params.key)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Config not found" }); return; }
  res.json(masked(rows[0]));
});

// ─── PUT /api/v1/admin/configs/:key ──────────────────────────────────────────
// Upsert: creates if missing, updates value/metadata if exists.
router.put("/:key", async (req, res) => {
  const { value, label, description, category, isSecret, isActive } = req.body as {
    value?: string;
    label?: string;
    description?: string;
    category?: string;
    isSecret?: boolean;
    isActive?: boolean;
  };

  const existing = await db
    .select()
    .from(platformConfigsTable)
    .where(eq(platformConfigsTable.key, req.params.key))
    .limit(1);

  const encryptedValue = value !== undefined
    ? (value === "" ? null : encrypt(value))
    : (existing[0]?.encryptedValue ?? null);

  if (existing[0]) {
    const [updated] = await db
      .update(platformConfigsTable)
      .set({
        encryptedValue,
        ...(label       !== undefined ? { label }       : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category    !== undefined ? { category }    : {}),
        ...(isSecret    !== undefined ? { isSecret }    : {}),
        ...(isActive    !== undefined ? { isActive }    : {}),
        updatedAt: new Date(),
      })
      .where(eq(platformConfigsTable.key, req.params.key))
      .returning();

    clearConfigCache(req.params.key);
    res.json(masked(updated!));
  } else {
    const [created] = await db
      .insert(platformConfigsTable)
      .values({
        key:         req.params.key,
        encryptedValue,
        category:    category    ?? "general",
        label:       label       ?? req.params.key,
        description: description ?? "",
        isSecret:    isSecret    ?? true,
        isActive:    isActive    ?? true,
      })
      .returning();

    clearConfigCache(req.params.key);
    res.status(201).json(masked(created!));
  }
});

// ─── DELETE /api/v1/admin/configs/:key ───────────────────────────────────────
router.delete("/:key", async (req, res) => {
  const result = await db
    .delete(platformConfigsTable)
    .where(eq(platformConfigsTable.key, req.params.key))
    .returning({ key: platformConfigsTable.key });

  if (!result[0]) { res.status(404).json({ error: "Config not found" }); return; }
  clearConfigCache(req.params.key);
  res.status(204).send();
});

// ─── POST /api/v1/admin/configs (bulk upsert) ────────────────────────────────
router.post("/", async (req, res) => {
  const { items } = req.body as { items: Array<{ key: string; value: string }> };
  if (!Array.isArray(items)) { res.status(400).json({ error: "items must be an array" }); return; }

  const results = [];
  for (const item of items) {
    const enc = item.value ? encrypt(item.value) : null;
    const existing = await db.select().from(platformConfigsTable).where(eq(platformConfigsTable.key, item.key)).limit(1);
    if (existing[0]) {
      const [updated] = await db.update(platformConfigsTable)
        .set({ encryptedValue: enc, updatedAt: new Date() })
        .where(eq(platformConfigsTable.key, item.key))
        .returning();
      results.push(masked(updated!));
    } else {
      const [created] = await db.insert(platformConfigsTable)
        .values({ key: item.key, encryptedValue: enc, label: item.key, category: "general", isSecret: true, isActive: true })
        .returning();
      results.push(masked(created!));
    }
    clearConfigCache(item.key);
  }

  res.json({ data: results });
});

export default router;
