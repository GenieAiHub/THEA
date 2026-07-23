import React from "react";
import { AlertCircle, Brain, PieChart, TrendingUp } from "lucide-react";

export interface SovPayload {
  previousSov?: number | null;
  currentSov?: number | null;
  sovDelta?: number | null;
  overtakenBy?: { entity: string; previousSov?: number; currentSov?: number } | null;
  kind?: string;
}

export function isSovAlert(alert: any): boolean {
  return alert?.type === "ai_sov";
}

const fmtPct = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : null;

/** "SoV 60% → 30%" when both values are present, otherwise null. */
export function sovShiftText(alert: any): string | null {
  if (!isSovAlert(alert)) return null;
  const p = (alert?.payload || {}) as SovPayload;
  const prev = fmtPct(p.previousSov);
  const cur = fmtPct(p.currentSov);
  if (prev == null || cur == null) return null;
  return `SoV ${prev} → ${cur}`;
}

/** "Overtaken by X" when a competitor overtake is part of the alert, otherwise null. */
export function sovOvertakenText(alert: any): string | null {
  if (!isSovAlert(alert)) return null;
  const p = (alert?.payload || {}) as SovPayload;
  return p.overtakenBy?.entity ? `Overtaken by ${p.overtakenBy.entity}` : null;
}

export interface AlertTypeInfo {
  label: string;
  badgeClass: string;
  icon: React.ReactNode;
}

/** Distinct label + icon per alert type so SoV alerts aren't confused with spike/sentiment ones. */
export function alertTypeInfo(alert: any): AlertTypeInfo {
  switch (alert?.type) {
    case "ai_sov":
      return {
        label: "SoV Shift",
        badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        icon: <PieChart className="w-3.5 h-3.5" />,
      };
    case "ai_narrative":
      return {
        label: "AI Narrative",
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        icon: <Brain className="w-3.5 h-3.5" />,
      };
    case "sentiment":
      return {
        label: "Sentiment",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
      };
    default:
      return {
        label: "Spike",
        badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        icon: <TrendingUp className="w-3.5 h-3.5" />,
      };
  }
}

/** Human-readable title derived from the alert row (rows have no title column). */
export function alertTitle(alert: any): string {
  if (alert?.title) return alert.title;
  const kw = alert?.keyword || "Unknown";
  if (isSovAlert(alert)) {
    const overtaken = sovOvertakenText(alert);
    if (overtaken) return `AI share of voice: ${kw} — ${overtaken.toLowerCase()}`;
    return `AI share of voice drop: ${kw}`;
  }
  if (alert?.type === "ai_narrative") return `AI narrative alert: ${kw}`;
  if (alert?.spikeRatio) return `Mention spike on "${kw}" (${Number(alert.spikeRatio).toFixed(1)}×)`;
  return `Alert on "${kw}"`;
}

/** Human-readable one-line description of the alert. */
export function alertDescription(alert: any): string {
  if (alert?.message || alert?.description) return alert.message || alert.description;
  if (isSovAlert(alert)) {
    const parts: string[] = [];
    const shift = sovShiftText(alert);
    if (shift) parts.push(`AI share of voice for "${alert.keyword}" shifted: ${shift}.`);
    const overtaken = sovOvertakenText(alert);
    if (overtaken) {
      const p = (alert?.payload || {}) as SovPayload;
      const compCur = fmtPct(p.overtakenBy?.currentSov);
      parts.push(`${overtaken}${compCur ? ` (now at ${compCur})` : ""}.`);
    }
    if (parts.length) return parts.join(" ");
    return `AI share of voice alert for "${alert.keyword}".`;
  }
  return "No detailed description provided.";
}
