import { Telegraf } from "telegraf";
import { db } from "@workspace/db";
import { emailPreferencesTable, apiKeysTable, trendScoresTable } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { logger } from "./logger";
import { getPlatformConfig } from "./platform-config";

/** Look up the orgId linked to a Telegram chat. Returns null if not connected. */
async function getOrgForChat(chatId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: emailPreferencesTable.orgId })
    .from(emailPreferencesTable)
    .where(eq(emailPreferencesTable.telegramChatId, chatId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

let botInstance: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  return botInstance;
}

/**
 * Send a message to a Telegram chat (used by alert dispatch).
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!botInstance) return;
  try {
    await botInstance.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    logger.warn({ err, chatId }, "Telegram message delivery failed");
  }
}

/**
 * Initialise and start the THEA Telegram bot.
 * Requires TELEGRAM_BOT_TOKEN env var.
 */
export async function startTelegramBot(): Promise<void> {
  let token: string | null = null;
  try {
    token = await getPlatformConfig("telegram_bot_token");
  } catch (err) {
    logger.warn({ err }, "Could not resolve telegram_bot_token — Telegram bot disabled");
    return;
  }
  if (!token) {
    logger.info("telegram_bot_token not set — Telegram bot disabled");
    return;
  }

  const bot = new Telegraf(token);
  botInstance = bot;

  bot.start((ctx) =>
    ctx.reply(
      "👋 Welcome to THEA Intelligence Bot!\n\nConnect your org with:\n`/connect <your_api_key>`\n\nThen use:\n• `/trends` — today's top 5 trends\n• `/status <keyword>` — latest score for a keyword\n• `/report` — link to latest PDF report",
      { parse_mode: "Markdown" },
    ),
  );

  bot.command("connect", async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const apiKey = parts[1];
    if (!apiKey) {
      await ctx.reply("❌ Usage: `/connect <your_api_key>`", { parse_mode: "Markdown" });
      return;
    }

    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyRows = await db
      .select({ orgId: apiKeysTable.orgId })
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.keyHash, keyHash), eq(apiKeysTable.isActive, true)))
      .limit(1);

    if (!keyRows[0]) {
      await ctx.reply("❌ Invalid or expired API key.");
      return;
    }

    const orgId = keyRows[0].orgId;
    const chatId = String(ctx.chat.id);

    await db
      .insert(emailPreferencesTable)
      .values({ orgId, recipients: [], telegramChatId: chatId })
      .onConflictDoUpdate({
        target: emailPreferencesTable.orgId,
        set: { telegramChatId: chatId, updatedAt: new Date() },
      });

    await ctx.reply("✅ Connected! THEA will now deliver spike alerts and digests to this chat.");
    logger.info({ orgId, chatId }, "Telegram chat connected to org");
  });

  bot.command("trends", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const orgId = await getOrgForChat(chatId);
    if (!orgId) {
      await ctx.reply("❌ Not connected. Use `/connect <your_api_key>` first.", { parse_mode: "Markdown" });
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trends = await db
      .select()
      .from(trendScoresTable)
      .where(and(eq(trendScoresTable.orgId, orgId), gte(trendScoresTable.scoredAt, since)))
      .orderBy(desc(trendScoresTable.score))
      .limit(5);

    if (!trends.length) {
      await ctx.reply("No trend data available yet for your org. Check back after the next analysis run.");
      return;
    }

    const lines = trends.map((t, i) => `${i + 1}. *${t.topic}* (${t.category}) — Score: ${Math.round(t.score)}`).join("\n");
    await ctx.reply(`📈 *Top 5 Trends (24h)*\n\n${lines}`, { parse_mode: "Markdown" });
  });

  bot.command("status", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const orgId = await getOrgForChat(chatId);
    if (!orgId) {
      await ctx.reply("❌ Not connected. Use `/connect <your_api_key>` first.", { parse_mode: "Markdown" });
      return;
    }

    const parts = ctx.message.text.split(/\s+/).slice(1);
    const keyword = parts.join(" ");
    if (!keyword) {
      await ctx.reply("Usage: `/status <keyword>`", { parse_mode: "Markdown" });
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(trendScoresTable)
      .where(and(eq(trendScoresTable.orgId, orgId), gte(trendScoresTable.scoredAt, since)))
      .orderBy(desc(trendScoresTable.score))
      .limit(100);

    const match = rows.find((r) => r.topic.toLowerCase().includes(keyword.toLowerCase()));
    if (!match) {
      await ctx.reply(`No trend data found for "*${keyword}*" in the past 24h.`, { parse_mode: "Markdown" });
      return;
    }

    await ctx.reply(
      `📊 *${match.topic}* (${match.category})\nScore: *${Math.round(match.score)}* | Stage: ${match.lifecycleStage ?? "unknown"}\nMentions: ${match.mentionCount ?? 0} | Velocity: ${match.velocityScore?.toFixed(1) ?? "N/A"}`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("report", async (ctx) => {
    const appUrl = (await getPlatformConfig("app_url")) ?? "https://app.thea.ai";
    await ctx.reply(`📄 Download your latest report from the THEA dashboard:\n${appUrl}/reports`);
  });

  bot.launch().then(() => {
    logger.info("Telegram bot started (long polling)");
  }).catch((err) => {
    logger.warn({ err }, "Telegram bot failed to start");
  });

  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  process.once("SIGINT", () => bot.stop("SIGINT"));
}
