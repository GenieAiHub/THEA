import { chatWithGpt } from "../llm";
import { logger } from "../logger";
import type { MiroFishReport } from "./mirofish";

export interface ParsedReport {
  trendingTopics: Array<{
    topic: string;
    score: number;
    trajectory: "rising" | "stable" | "declining";
    evidenceStrength: number;
    summary: string;
  }>;
  sentimentOverall: string;
  narrativeSummary: string;
  keyEntities: Array<{ name: string; type: string; significance: number }>;
  predictions: Array<{ timeframe: string; prediction: string; confidence: number }>;
  dominantNarratives: string[];
}

export function parseStructuredReport(report: MiroFishReport): ParsedReport {
  return {
    trendingTopics: (report.trendingTopics ?? []).map((t) => ({
      topic: String(t.topic ?? "").slice(0, 200),
      score: Math.max(0, Math.min(100, Number(t.score ?? 0))),
      trajectory: (["rising", "stable", "declining"].includes(t.trajectory ?? "") ? t.trajectory : "stable") as "rising" | "stable" | "declining",
      evidenceStrength: Math.max(0, Math.min(1, Number(t.evidenceStrength ?? 0.5))),
      summary: String(t.summary ?? "").slice(0, 500),
    })),
    sentimentOverall: String(report.sentimentOverall ?? "neutral"),
    narrativeSummary: String(report.narrativeSummary ?? "").slice(0, 2000),
    keyEntities: (report.keyEntities ?? []).slice(0, 20).map((e) => ({
      name: String(e.name ?? ""),
      type: String(e.type ?? "topic"),
      significance: Math.max(0, Math.min(1, Number(e.significance ?? 0.5))),
    })),
    predictions: (report.predictions ?? []).map((p) => ({
      timeframe: String(p.timeframe ?? "24h"),
      prediction: String(p.prediction ?? "").slice(0, 500),
      confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
    })),
    dominantNarratives: (report.dominantNarratives ?? []).slice(0, 10).map(String),
  };
}

const PARSE_PROMPT = `Extract structured data from this narrative analysis report. Output ONLY JSON:
{
  "trendingTopics": [{"topic": string, "score": integer 0-100, "trajectory": "rising|stable|declining", "evidenceStrength": float, "summary": string}],
  "sentimentOverall": "positive|neutral|negative|mixed",
  "narrativeSummary": string,
  "keyEntities": [{"name": string, "type": "person|org|location|topic", "significance": float 0-1}],
  "predictions": [{"timeframe": "6h|24h|72h", "prediction": string, "confidence": float 0-1}],
  "dominantNarratives": [string]
}`;

export async function parseRawReport(rawReport: string, category: string): Promise<ParsedReport> {
  const trimmed = rawReport.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const cleaned = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as MiroFishReport;
      if (parsed.trendingTopics || parsed.narrativeSummary) {
        return parseStructuredReport(parsed);
      }
    } catch {}
  }

  try {
    const resp = await chatWithGpt(
      [
        { role: "system", content: PARSE_PROMPT },
        { role: "user", content: `Category: ${category}\n\nReport:\n${rawReport.slice(0, 6000)}` },
      ],
      { model: "gpt-4o-mini", operation: "report_parse" }
    );

    const clean = resp.content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean) as MiroFishReport;
    return parseStructuredReport(parsed);
  } catch (err) {
    logger.warn({ err, category }, "Report parsing failed — returning minimal parsed report");
    return {
      trendingTopics: [],
      sentimentOverall: "neutral",
      narrativeSummary: rawReport.slice(0, 500),
      keyEntities: [],
      predictions: [],
      dominantNarratives: [],
    };
  }
}
