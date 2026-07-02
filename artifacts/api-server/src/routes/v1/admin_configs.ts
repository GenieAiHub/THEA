import { Router } from "express";
import { db } from "@workspace/db";
import { platformConfigsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { encrypt, safeDecrypt } from "../../lib/crypto";
import { clearConfigCache } from "../../lib/llm";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Default seed config catalogue ───────────────────────────────────────────
const DEFAULT_CONFIGS: Array<{
  key: string;
  label: string;
  description: string;
  category: string;
  isSecret: boolean;
}> = [
  // LLM
  { key: "openai_api_key",       label: "OpenAI API Key",          description: "sk-... key from platform.openai.com",       category: "llm",     isSecret: true  },
  { key: "openai_default_model", label: "OpenAI Default Model",    description: "e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo",    category: "llm",     isSecret: false },
  { key: "gemini_api_key",       label: "Gemini API Key",          description: "API key from Google AI Studio",              category: "llm",     isSecret: true  },
  { key: "gemini_default_model", label: "Gemini Default Model",    description: "e.g. gemini-1.5-flash, gemini-1.5-pro",     category: "llm",     isSecret: false },
  // Search / Scraping
  { key: "serper_api_key",       label: "Serper API Key",          description: "Google Search API via serper.dev",           category: "search",  isSecret: true  },
  { key: "bing_search_api_key",  label: "Bing Search API Key",     description: "Microsoft Cognitive Services search key",    category: "search",  isSecret: true  },
  // Social media
  { key: "twitter_bearer_token", label: "Twitter Bearer Token",    description: "OAuth 2.0 bearer token for Twitter API v2",  category: "social",  isSecret: true  },
  { key: "reddit_client_id",     label: "Reddit Client ID",        description: "Reddit app client ID",                       category: "social",  isSecret: false },
  { key: "reddit_client_secret", label: "Reddit Client Secret",    description: "Reddit app client secret",                   category: "social",  isSecret: true  },
  // Payments
  { key: "stripe_secret_key",    label: "Stripe Secret Key",       description: "sk_live_... or sk_test_... from Stripe",     category: "payments",isSecret: true  },
  { key: "stripe_webhook_secret",label: "Stripe Webhook Secret",   description: "whsec_... endpoint signing secret",          category: "payments",isSecret: true  },
  // Comms
  { key: "sendgrid_api_key",     label: "SendGrid API Key",        description: "Email delivery API key",                     category: "email",   isSecret: true  },
  { key: "sendgrid_from_email",  label: "SendGrid From Email",     description: "Sender address for platform emails",         category: "email",   isSecret: false },
  // Misc platform
  { key: "platform_name",        label: "Platform Name",           description: "Displayed in UI and emails",                 category: "general", isSecret: false },
  { key: "support_email",        label: "Support Email",           description: "User-facing support contact email",          category: "general", isSecret: false },
];

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
