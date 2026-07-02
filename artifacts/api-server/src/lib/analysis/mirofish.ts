import { logger } from "../logger";
import { chatWithGpt } from "../llm";

const MIROFISH_URL = process.env.MIROFISH_URL;
const MIROFISH_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

export interface MiroFishReport {
  trendingTopics: Array<{
    topic: string;
    score: number;
    trajectory: "rising" | "stable" | "declining";
    evidenceStrength: number;
    summary: string;
  }>;
  sentimentOverall: "positive" | "neutral" | "negative" | "mixed";
  narrativeSummary: string;
  keyEntities: Array<{ name: string; type: string; significance: number }>;
  predictions: Array<{ timeframe: string; prediction: string; confidence: number }>;
  dominantNarratives: string[];
  simulationMeta?: Record<string, unknown>;
}

interface MiroFishApiRun {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  report?: MiroFishReport;
  error?: string;
}

async function submitToMiroFishService(seedDocument: string, category: string): Promise<string> {
  const res = await fetch(`${MIROFISH_URL}/api/v1/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seedDocument, category, options: { agentCount: 10, rounds: 5 } }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiroFish submit failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { runId: string };
  return data.runId;
}

async function pollMiroFishRun(runId: string): Promise<MiroFishReport> {
  const deadline = Date.now() + MIROFISH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${MIROFISH_URL}/api/v1/simulate/${runId}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) continue;

    const run = await res.json() as MiroFishApiRun;

    if (run.status === "completed" && run.report) {
      return run.report;
    }

    if (run.status === "failed") {
      throw new Error(`MiroFish run failed: ${run.error ?? "unknown"}`);
    }

    logger.debug({ runId, status: run.status }, "MiroFish run in progress...");
  }

  throw new Error(`MiroFish run ${runId} timed out after ${MIROFISH_TIMEOUT_MS / 60000} minutes`);
}

const GPT_SIMULATION_PROMPT = `You are MiroFish, an AI agent simulation engine that analyses media narratives.
Given a seed intelligence document, you simulate multiple AI agents discussing and debating the content,
then synthesise their findings into a structured trend analysis report.

Output ONLY a JSON object with this exact structure:
{
  "trendingTopics": [
    {
      "topic": "exact topic phrase",
      "score": <integer 0-100>,
      "trajectory": "rising|stable|declining",
      "evidenceStrength": <float 0-1>,
      "summary": "one sentence about why this is trending"
    }
  ],
  "sentimentOverall": "positive|neutral|negative|mixed",
  "narrativeSummary": "3-4 sentence overview of dominant narratives in this content window",
  "keyEntities": [
    {"name": "entity name", "type": "person|org|location|topic", "significance": <float 0-1>}
  ],
  "predictions": [
    {"timeframe": "6h|24h|72h", "prediction": "what is likely to happen", "confidence": <float 0-1>}
  ],
  "dominantNarratives": ["narrative 1", "narrative 2", "narrative 3"]
}

Rules:
- trendingTopics: 5-10 topics, ordered by score descending
- keyEntities: 5-10 entities, ordered by significance descending
- predictions: one for each timeframe (6h, 24h, 72h)
- dominantNarratives: 3-5 recurring themes or frames
- Never include prose outside the JSON`;

async function simulateWithGpt(seedDocument: string, category: string): Promise<MiroFishReport> {
  logger.info({ category }, "MiroFish URL not configured — using GPT-4o simulation");

  const resp = await chatWithGpt(
    [
      { role: "system", content: GPT_SIMULATION_PROMPT },
      {
        role: "user",
        content: `Analyse this ${category} intelligence seed document and produce the MiroFish report:\n\n${seedDocument.slice(0, 12000)}`,
      },
    ],
    { model: "gpt-4o", operation: "mirofish_simulation" }
  );

  try {
    const clean = resp.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean) as MiroFishReport;
    parsed.simulationMeta = { provider: "gpt-4o-simulation", durationMs: resp.durationMs };
    return parsed;
  } catch {
    logger.warn({ raw: resp.content.slice(0, 500) }, "GPT-4o MiroFish output failed to parse — returning empty report");
    return buildEmptyReport(category);
  }
}

function buildEmptyReport(category: string): MiroFishReport {
  return {
    trendingTopics: [],
    sentimentOverall: "neutral",
    narrativeSummary: `No significant trends detected in ${category} content for this window.`,
    keyEntities: [],
    predictions: [
      { timeframe: "6h", prediction: "Insufficient data for prediction", confidence: 0 },
      { timeframe: "24h", prediction: "Insufficient data for prediction", confidence: 0 },
      { timeframe: "72h", prediction: "Insufficient data for prediction", confidence: 0 },
    ],
    dominantNarratives: [],
  };
}

export async function runMiroFishAnalysis(
  seedDocument: string,
  category: string
): Promise<{ runId: string; report: MiroFishReport }> {
  if (!MIROFISH_URL) {
    const report = await simulateWithGpt(seedDocument, category);
    return { runId: `gpt-sim-${Date.now()}`, report };
  }

  try {
    const runId = await submitToMiroFishService(seedDocument, category);
    logger.info({ runId, category }, "MiroFish simulation submitted");
    const report = await pollMiroFishRun(runId);
    return { runId, report };
  } catch (err) {
    logger.warn({ err, category }, "MiroFish service failed — falling back to GPT-4o simulation");
    const report = await simulateWithGpt(seedDocument, category);
    return { runId: `gpt-fallback-${Date.now()}`, report };
  }
}
