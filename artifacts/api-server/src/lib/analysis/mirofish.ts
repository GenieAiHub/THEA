import { logger } from "../logger";
import { chatWithGpt } from "../llm";
import { parseRawReport } from "./report-parser";

const MIROFISH_URL = process.env.MIROFISH_URL;
const MIROFISH_MAX_ROUNDS = Number(process.env.MIROFISH_MAX_ROUNDS ?? 10);

// Per-step timeouts / deadlines (ms). MiroFish's OASIS pipeline is long-running:
// ontology generation is a synchronous in-request LLM call, the rest are async
// jobs polled to completion.
const HEALTH_TIMEOUT_MS = 5_000;
const ONTOLOGY_TIMEOUT_MS = 10 * 60_000; // synchronous LLM ontology generation
const CALL_TIMEOUT_MS = 30_000; // ordinary control-plane calls
const POLL_INTERVAL_MS = 10_000;
const BUILD_DEADLINE_MS = 20 * 60_000;
const PREPARE_DEADLINE_MS = 20 * 60_000;
const RUN_DEADLINE_MS = 40 * 60_000;
const REPORT_DEADLINE_MS = 20 * 60_000;

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

// ─── Real MiroFish pipeline client ───────────────────────────────────────────

/** Call a MiroFish endpoint and unwrap its `{ success, data }` envelope. */
async function mfCall<T = unknown>(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<T> {
  const res = await fetch(`${MIROFISH_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: { success?: boolean; data?: unknown; error?: string };
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`MiroFish ${path} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(`MiroFish ${path} failed (${res.status}): ${json.error ?? text.slice(0, 200)}`);
  }
  return json.data as T;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ─── Circuit breaker: "primary MiroFish, fallback GPT-4o" ────────────────────
// The What-If simulator prefers the real OASIS pipeline (Option B) but falls
// back to GPT-4o (Option A) on any failure. A naive "always try B first" is
// wasteful on Zep's free tier: once the monthly quota is exhausted every request
// would grind through a doomed 20-40min pipeline (and its LLM spend) before
// failing over. The breaker trips after MIROFISH_BREAKER_THRESHOLD consecutive
// failures and then serves GPT-4o directly for MIROFISH_BREAKER_COOLDOWN_MS
// before probing MiroFish again (half-open) — so B stays primary but A carries
// the load cheaply while B is unavailable.
const BREAKER_THRESHOLD = Number(process.env.MIROFISH_BREAKER_THRESHOLD ?? 3);
const BREAKER_COOLDOWN_MS = Number(process.env.MIROFISH_BREAKER_COOLDOWN_MS ?? 30 * 60_000);
const breaker = { consecutiveFailures: 0, openUntil: 0 };

function breakerIsOpen(): boolean {
  return Date.now() < breaker.openUntil;
}

function recordBreakerSuccess(): void {
  breaker.consecutiveFailures = 0;
  breaker.openUntil = 0;
}

function recordBreakerFailure(): void {
  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= BREAKER_THRESHOLD) {
    breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
}

/** Run the GPT-4o path (Option A) and tag why we fell back off MiroFish. */
async function gptFallback(
  seedDocument: string,
  category: string,
  reason: string
): Promise<{ runId: string; report: MiroFishReport }> {
  const fallback = await runGptAnalysis(seedDocument, category);
  fallback.report.simulationMeta = {
    ...(fallback.report.simulationMeta ?? {}),
    fallbackFrom: "mirofish",
    fallbackReason: reason,
  };
  return fallback;
}

/**
 * Poll a MiroFish status endpoint until it reaches a terminal state.
 * Transient errors (e.g. a task-id 404 after an in-memory TaskManager reset)
 * are tolerated and retried until the deadline — status endpoints resolve via
 * `simulation_id` as a fallback, so we always pass both ids.
 */
async function pollStatus(
  label: string,
  deadlineMs: number,
  fetchStatus: () => Promise<{ status?: string }>,
  doneStatuses: string[],
  failStatuses: string[] = ["failed"]
): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let status = "";
    try {
      const data = await fetchStatus();
      status = String(data?.status ?? "");
    } catch (err) {
      logger.debug({ err, label }, "MiroFish poll transient error — retrying");
      continue;
    }
    if (doneStatuses.includes(status)) return;
    if (failStatuses.includes(status)) throw new Error(`MiroFish ${label} failed (status=${status})`);
    logger.debug({ label, status }, "MiroFish pipeline in progress...");
  }
  throw new Error(`MiroFish ${label} timed out after ${Math.round(deadlineMs / 60_000)}min`);
}

/**
 * Drive MiroFish's real multi-agent simulation pipeline end to end, then map
 * the free-form markdown report into THEA's structured MiroFishReport. Any
 * failure (including MiroFish being unavailable) falls back to the GPT-4o path
 * so a simulation request never hard-fails. A circuit breaker keeps MiroFish as
 * the primary path while short-circuiting straight to GPT-4o once it is
 * repeatedly failing (see the breaker block above).
 *
 * Only invoked by the on-demand What-If simulator — never the hourly scheduler.
 */
export async function runMiroFishPipeline(
  seedDocument: string,
  simulationRequirement: string,
  category: string
): Promise<{ runId: string; report: MiroFishReport }> {
  // Option B not configured → Option A only.
  if (!MIROFISH_URL) {
    logger.warn({ category }, "MIROFISH_URL not set — using GPT-4o simulation for What-If run");
    return runGptAnalysis(seedDocument, category);
  }

  // Breaker open → skip the doomed pipeline, serve GPT-4o directly (half-open on expiry).
  if (breakerIsOpen()) {
    const cooldownSec = Math.round((breaker.openUntil - Date.now()) / 1000);
    logger.warn(
      { category, cooldownSec, consecutiveFailures: breaker.consecutiveFailures },
      "MiroFish circuit open — serving GPT-4o fallback without attempting the OASIS pipeline"
    );
    return gptFallback(seedDocument, category, "circuit-open");
  }

  let createdSimulationId: string | undefined;
  try {
    // 0) Health pre-check — fail fast to GPT instead of after a partial pipeline.
    await mfCall("/health", { method: "GET" }, HEALTH_TIMEOUT_MS);

    // 1) Ontology generation (multipart; synchronous LLM call).
    const form = new FormData();
    form.append("files", new Blob([seedDocument], { type: "text/plain" }), "seed.txt");
    form.append("simulation_requirement", simulationRequirement);
    form.append("project_name", `thea-${category}-${Date.now()}`);
    const ontology = await mfCall<{ project_id: string }>(
      "/api/graph/ontology/generate",
      { method: "POST", body: form },
      ONTOLOGY_TIMEOUT_MS
    );
    const projectId = ontology.project_id;
    logger.info({ projectId, category }, "MiroFish: ontology generated");

    // 2) Build the knowledge graph (async task).
    const build = await mfCall<{ task_id: string }>(
      "/api/graph/build",
      jsonPost({ project_id: projectId }),
      CALL_TIMEOUT_MS
    );
    await pollStatus(
      "graph build",
      BUILD_DEADLINE_MS,
      () => mfCall<{ status: string }>(`/api/graph/task/${build.task_id}`, { method: "GET" }, CALL_TIMEOUT_MS),
      ["completed"]
    );
    logger.info({ projectId }, "MiroFish: graph built");

    // 3) Create the simulation (single platform to bound cost).
    const sim = await mfCall<{ simulation_id: string }>(
      "/api/simulation/create",
      jsonPost({ project_id: projectId, enable_twitter: false, enable_reddit: true }),
      CALL_TIMEOUT_MS
    );
    const simulationId = sim.simulation_id;
    createdSimulationId = simulationId; // enables best-effort env cleanup in finally

    // 4) Prepare agents (async task; status endpoint also resolves by simulation_id).
    const prep = await mfCall<{ task_id: string }>(
      "/api/simulation/prepare",
      jsonPost({ simulation_id: simulationId }),
      CALL_TIMEOUT_MS
    );
    await pollStatus(
      "simulation prepare",
      PREPARE_DEADLINE_MS,
      () =>
        mfCall<{ status: string }>(
          "/api/simulation/prepare/status",
          jsonPost({ task_id: prep.task_id, simulation_id: simulationId }),
          CALL_TIMEOUT_MS
        ),
      ["completed", "ready"]
    );
    logger.info({ simulationId }, "MiroFish: simulation prepared");

    // 5) Run the simulation (async), then poll its RUNNER status to completion.
    // NB: GET /api/simulation/<id> reports the lifecycle `status`, which stays
    // "running" until the env is explicitly closed — natural completion is only
    // reflected in `runner_status` via the dedicated run-status endpoint (which
    // returns "idle" until the runner spins up, hence not a terminal state).
    await mfCall(
      "/api/simulation/start",
      jsonPost({
        simulation_id: simulationId,
        platform: "reddit",
        max_rounds: MIROFISH_MAX_ROUNDS,
        enable_graph_memory_update: false,
      }),
      CALL_TIMEOUT_MS
    );
    await pollStatus(
      "simulation run",
      RUN_DEADLINE_MS,
      async () => {
        const data = await mfCall<{ runner_status?: string }>(
          `/api/simulation/${simulationId}/run-status`,
          { method: "GET" },
          CALL_TIMEOUT_MS
        );
        return { status: data.runner_status };
      },
      ["completed"],
      ["failed", "stopped"]
    );
    logger.info({ simulationId }, "MiroFish: simulation finished");

    // 6) Generate the report (async task) and fetch its markdown.
    const gen = await mfCall<{ report_id: string; task_id: string }>(
      "/api/report/generate",
      jsonPost({ simulation_id: simulationId }),
      CALL_TIMEOUT_MS
    );
    await pollStatus(
      "report generate",
      REPORT_DEADLINE_MS,
      () =>
        mfCall<{ status: string }>(
          "/api/report/generate/status",
          jsonPost({ task_id: gen.task_id, simulation_id: simulationId }),
          CALL_TIMEOUT_MS
        ),
      ["completed"]
    );
    const report = await mfCall<{ markdown_content?: string; outline?: unknown }>(
      `/api/report/${gen.report_id}`,
      { method: "GET" },
      CALL_TIMEOUT_MS
    );

    const markdown = report.markdown_content ?? "";
    if (!markdown.trim()) throw new Error("MiroFish report has empty markdown_content");

    // Map MiroFish's free-form markdown into THEA's structured schema.
    const parsed = await parseRawReport(markdown, category);
    const structured: MiroFishReport = {
      ...parsed,
      sentimentOverall: normalizeSentiment(parsed.sentimentOverall),
      simulationMeta: {
        provider: "mirofish",
        projectId,
        simulationId,
        reportId: gen.report_id,
        maxRounds: MIROFISH_MAX_ROUNDS,
        outline: report.outline,
        markdown,
      },
    };
    logger.info({ simulationId, reportId: gen.report_id, category }, "MiroFish pipeline complete");
    recordBreakerSuccess();
    return { runId: `mirofish-${gen.report_id}`, report: structured };
  } catch (err) {
    recordBreakerFailure();
    logger.warn(
      { err, category, consecutiveFailures: breaker.consecutiveFailures, circuitOpened: breakerIsOpen() },
      "MiroFish pipeline failed — falling back to GPT-4o simulation"
    );
    return gptFallback(seedDocument, category, err instanceof Error ? err.message : "pipeline-error");
  } finally {
    // Best-effort: release the sidecar's simulation env process so long-lived
    // runs don't pile up. Never let cleanup failures affect the result.
    if (createdSimulationId && MIROFISH_URL) {
      try {
        await mfCall(
          "/api/simulation/close-env",
          jsonPost({ simulation_id: createdSimulationId }),
          CALL_TIMEOUT_MS
        );
        logger.debug({ simulationId: createdSimulationId }, "MiroFish: env released");
      } catch (err) {
        logger.debug({ err, simulationId: createdSimulationId }, "MiroFish close-env cleanup failed (non-fatal)");
      }
    }
  }
}

function normalizeSentiment(s: string): MiroFishReport["sentimentOverall"] {
  return (["positive", "neutral", "negative", "mixed"].includes(s) ? s : "neutral") as MiroFishReport["sentimentOverall"];
}

// ─── GPT-4o path (hourly scheduler + fallback) ───────────────────────────────

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

/**
 * Fast single-call GPT-4o trend analysis. Powers the hourly scheduler and acts
 * as the fallback for the on-demand pipeline.
 */
export async function runGptAnalysis(
  seedDocument: string,
  category: string
): Promise<{ runId: string; report: MiroFishReport }> {
  logger.info({ category }, "Running GPT-4o trend analysis");

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
    return { runId: `gpt-sim-${Date.now()}`, report: parsed };
  } catch {
    logger.warn({ raw: resp.content.slice(0, 500) }, "GPT-4o MiroFish output failed to parse — returning empty report");
    return { runId: `gpt-empty-${Date.now()}`, report: buildEmptyReport(category) };
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
