import { db } from "@workspace/db";
import {
  predictionMarketsTable,
  marketVotesTable,
  platformConfigsTable,
  trendScoresTable,
  type PredictionMarket,
} from "@workspace/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { encrypt, safeDecrypt } from "./crypto";
import { chat, type LlmProvider } from "./llm";
import { getQueues } from "./queues";
import { logger } from "./logger";

// ─── Settings (stored in platform_configs) ───────────────────────────────────

export interface MarketSettings {
  enabled: boolean;
  frequencyMinutes: number;
  topics: string[];
  marketsPerRun: number;
  lastRunAt: string | null;
}

const SETTING_KEYS = {
  enabled: "markets_auto_enabled",
  frequencyMinutes: "markets_frequency_minutes",
  topics: "markets_topics",
  marketsPerRun: "markets_per_run",
  lastRunAt: "markets_last_run_at",
} as const;

const DEFAULTS: MarketSettings = {
  enabled: true,
  frequencyMinutes: 360,
  topics: [],
  marketsPerRun: 3,
  lastRunAt: null,
};

const SETTING_LABELS: Record<string, string> = {
  [SETTING_KEYS.enabled]: "Markets Auto-Generation Enabled",
  [SETTING_KEYS.frequencyMinutes]: "Markets Generation Frequency (minutes)",
  [SETTING_KEYS.topics]: "Markets Generation Topics",
  [SETTING_KEYS.marketsPerRun]: "Markets Generated Per Run",
  [SETTING_KEYS.lastRunAt]: "Markets Last Generation Run",
};

async function readConfig(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(platformConfigsTable)
    .where(eq(platformConfigsTable.key, key))
    .limit(1);
  if (!rows[0]) return null;
  return safeDecrypt(rows[0].encryptedValue);
}

async function writeConfig(key: string, value: string): Promise<void> {
  const encryptedValue = encrypt(value);
  const existing = await db
    .select({ id: platformConfigsTable.id })
    .from(platformConfigsTable)
    .where(eq(platformConfigsTable.key, key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(platformConfigsTable)
      .set({ encryptedValue, updatedAt: new Date() })
      .where(eq(platformConfigsTable.key, key));
  } else {
    await db.insert(platformConfigsTable).values({
      key,
      encryptedValue,
      category: "markets",
      label: SETTING_LABELS[key] ?? key,
      description: "THEA Markets auto-generation setting",
      isSecret: false,
      isActive: true,
    });
  }
}

export async function getMarketSettings(): Promise<MarketSettings> {
  const [enabled, freq, topics, perRun, lastRun] = await Promise.all([
    readConfig(SETTING_KEYS.enabled),
    readConfig(SETTING_KEYS.frequencyMinutes),
    readConfig(SETTING_KEYS.topics),
    readConfig(SETTING_KEYS.marketsPerRun),
    readConfig(SETTING_KEYS.lastRunAt),
  ]);

  let parsedTopics: string[] = DEFAULTS.topics;
  if (topics) {
    try {
      const arr = JSON.parse(topics);
      if (Array.isArray(arr)) parsedTopics = arr.filter((t): t is string => typeof t === "string");
    } catch {
      parsedTopics = topics.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  return {
    enabled: enabled === null ? DEFAULTS.enabled : enabled === "true",
    frequencyMinutes: freq ? Math.max(5, parseInt(freq, 10) || DEFAULTS.frequencyMinutes) : DEFAULTS.frequencyMinutes,
    topics: parsedTopics,
    marketsPerRun: perRun ? Math.min(10, Math.max(1, parseInt(perRun, 10) || DEFAULTS.marketsPerRun)) : DEFAULTS.marketsPerRun,
    lastRunAt: lastRun,
  };
}

export async function updateMarketSettings(input: {
  enabled?: boolean;
  frequencyMinutes?: number;
  topics?: string[];
  marketsPerRun?: number;
}): Promise<MarketSettings> {
  const writes: Promise<void>[] = [];
  if (input.enabled !== undefined) writes.push(writeConfig(SETTING_KEYS.enabled, String(input.enabled)));
  if (input.frequencyMinutes !== undefined) writes.push(writeConfig(SETTING_KEYS.frequencyMinutes, String(input.frequencyMinutes)));
  if (input.topics !== undefined) writes.push(writeConfig(SETTING_KEYS.topics, JSON.stringify(input.topics)));
  if (input.marketsPerRun !== undefined) writes.push(writeConfig(SETTING_KEYS.marketsPerRun, String(input.marketsPerRun)));
  await Promise.all(writes);

  const settings = await getMarketSettings();
  await syncMarketGenerationSchedule(settings);
  return settings;
}

// ─── Repeatable job scheduling ────────────────────────────────────────────────

const SCHEDULER_ID = "market-autogen";

export async function syncMarketGenerationSchedule(settings?: MarketSettings): Promise<void> {
  const s = settings ?? (await getMarketSettings());
  const queue = getQueues().marketGeneration;
  if (!queue) throw new Error("market-generation queue not initialized");

  if (s.enabled) {
    await queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: s.frequencyMinutes * 60_000 },
      { name: "generate-markets", data: {} },
    );
    logger.info({ frequencyMinutes: s.frequencyMinutes }, "Market auto-generation scheduled");
  } else {
    await queue.removeJobScheduler(SCHEDULER_ID);
    logger.info("Market auto-generation disabled — scheduler removed");
  }
}

// ─── Serialization (aggregate votes → percentages) ────────────────────────────

export interface SerializedMarket {
  id: string;
  question: string;
  description: string | null;
  category: string;
  options: Array<{ label: string; votes: number; percentage: number }>;
  totalVotes: number;
  status: string;
  resolvedOption: number | null;
  source: string;
  sourceTopic: string | null;
  closesAt: string | null;
  createdAt: string;
}

export async function serializeMarkets(rows: PredictionMarket[]): Promise<SerializedMarket[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({
      marketId: marketVotesTable.marketId,
      optionIndex: marketVotesTable.optionIndex,
      count: sql<number>`count(*)::int`,
    })
    .from(marketVotesTable)
    .where(inArray(marketVotesTable.marketId, ids))
    .groupBy(marketVotesTable.marketId, marketVotesTable.optionIndex);

  const byMarket = new Map<string, Map<number, number>>();
  for (const c of counts) {
    if (!byMarket.has(c.marketId)) byMarket.set(c.marketId, new Map());
    byMarket.get(c.marketId)!.set(c.optionIndex, c.count);
  }

  const now = Date.now();

  return rows.map((row) => {
    const voteMap = byMarket.get(row.id) ?? new Map<number, number>();
    const labels = Array.isArray(row.options) ? row.options : [];
    const totalVotes = labels.reduce((sum, _l, i) => sum + (voteMap.get(i) ?? 0), 0);
    const options = labels.map((label, i) => {
      const votes = voteMap.get(i) ?? 0;
      return {
        label,
        votes,
        percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0,
      };
    });

    // Effective status: markets past closesAt read as closed
    let status = row.status;
    if (status === "open" && row.closesAt && row.closesAt.getTime() < now) {
      status = "closed";
    }

    return {
      id: row.id,
      question: row.question,
      description: row.description,
      category: row.category,
      options,
      totalVotes,
      status,
      resolvedOption: row.resolvedOption,
      source: row.source,
      sourceTopic: row.sourceTopic,
      closesAt: row.closesAt ? row.closesAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

// ─── LLM generation from trend data ──────────────────────────────────────────

interface GeneratedPoll {
  question: string;
  description?: string;
  category: string;
  options: string[];
  closesInDays?: number;
  sourceTopic?: string;
}

async function pickProvider(): Promise<LlmProvider> {
  const openaiKey = await readConfig("openai_api_key");
  if (openaiKey) return "openai";
  const geminiKey = await readConfig("gemini_api_key");
  if (geminiKey) return "gemini";
  throw new Error(
    "No LLM API key configured — add an OpenAI or Gemini API key in Super Admin → API Keys to enable market generation.",
  );
}

function parsePolls(raw: string): GeneratedPoll[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON array");
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("LLM response is not an array");

  const polls: GeneratedPoll[] = [];
  for (const item of parsed) {
    if (
      typeof item === "object" && item !== null &&
      typeof (item as GeneratedPoll).question === "string" &&
      typeof (item as GeneratedPoll).category === "string" &&
      Array.isArray((item as GeneratedPoll).options) &&
      (item as GeneratedPoll).options.length >= 2 &&
      (item as GeneratedPoll).options.length <= 6 &&
      (item as GeneratedPoll).options.every((o) => typeof o === "string" && o.trim().length > 0)
    ) {
      polls.push(item as GeneratedPoll);
    }
  }
  return polls;
}

export async function generateMarketsNow(): Promise<{ generated: number; markets: SerializedMarket[]; message: string }> {
  const settings = await getMarketSettings();
  const provider = await pickProvider();

  // Gather trend context: top recent trend scores, optionally focused on admin topics
  const trends = await db
    .select({
      topic: trendScoresTable.topic,
      category: trendScoresTable.category,
      score: trendScoresTable.score,
      lifecycleStage: trendScoresTable.lifecycleStage,
      mentionCount: trendScoresTable.mentionCount,
      sentimentAvg: trendScoresTable.sentimentAvg,
    })
    .from(trendScoresTable)
    .orderBy(desc(trendScoresTable.scoredAt), desc(trendScoresTable.score))
    .limit(15);

  const existingQuestions = await db
    .select({ question: predictionMarketsTable.question })
    .from(predictionMarketsTable)
    .orderBy(desc(predictionMarketsTable.createdAt))
    .limit(50);

  const trendContext = trends.length > 0
    ? trends.map((t) => `- "${t.topic}" (category: ${t.category}, score: ${t.score.toFixed(1)}, stage: ${t.lifecycleStage ?? "n/a"}, mentions: ${t.mentionCount ?? 0}, sentiment: ${t.sentimentAvg?.toFixed(2) ?? "n/a"})`).join("\n")
    : "(no trend data available yet — generate timely questions about current global topics instead)";

  const topicFocus = settings.topics.length > 0
    ? `Focus ONLY on these topics/areas chosen by the platform admin: ${settings.topics.join(", ")}.`
    : "Cover a diverse mix of the trending topics.";

  const prompt = `You are the poll generator for THEA Markets, a public opinion prediction platform (like Polymarket but free polls, no money). Generate exactly ${settings.marketsPerRun} engaging prediction poll questions based on the trending topics detected by THEA's media scanning engine.

Current trending topics:
${trendContext}

${topicFocus}

Avoid duplicating these existing questions:
${existingQuestions.map((q) => `- ${q.question}`).join("\n") || "(none)"}

Rules:
- Questions must be about concrete near-future outcomes or public opinion (e.g. "Will X happen by <date>?", "Which Y will lead Z by <month>?")
- Each question needs 2-4 short answer options. Binary questions use ["Yes", "No"].
- Every question must be answerable/verifiable within 90 days.
- Write a 1-2 sentence description giving context for each question.
- category: a single short word like Politics, Tech, Economy, Sports, Culture, Science, Climate.
- closesInDays: integer 3-90, when voting should close.
- sourceTopic: the trending topic that inspired the question.

Respond with ONLY a JSON array, no prose:
[{"question": "...", "description": "...", "category": "...", "options": ["...", "..."], "closesInDays": 30, "sourceTopic": "..."}]`;

  const response = await chat(provider, [{ role: "user", content: prompt }], {
    operation: "market-generation",
  });

  const polls = parsePolls(response.content);
  if (polls.length === 0) {
    throw new Error("LLM returned no valid poll questions");
  }

  const toInsert = polls.slice(0, settings.marketsPerRun).map((p) => ({
    question: p.question.trim(),
    description: p.description?.trim() || null,
    category: p.category.trim() || "General",
    options: p.options.map((o) => o.trim()),
    status: "open",
    source: "auto",
    sourceTopic: p.sourceTopic?.trim() || null,
    closesAt: new Date(Date.now() + Math.min(90, Math.max(3, p.closesInDays ?? 30)) * 24 * 60 * 60 * 1000),
  }));

  const inserted = await db.insert(predictionMarketsTable).values(toInsert).returning();
  await writeConfig(SETTING_KEYS.lastRunAt, new Date().toISOString());

  logger.info({ generated: inserted.length, provider }, "Generated prediction markets from trend data");

  const serialized = await serializeMarkets(inserted);
  return {
    generated: inserted.length,
    markets: serialized,
    message: `Generated ${inserted.length} market(s) via ${provider}`,
  };
}
