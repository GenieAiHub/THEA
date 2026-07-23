import type { Feather } from "@expo/vector-icons";

import type { OrgAlert } from "./types";

/**
 * Presentation helpers for org intelligence alerts (spike / ai_narrative /
 * ai_sov). Mirrors the portal's alertPresentation so an "ai_sov" alert reads
 * as a share-of-voice story ("SoV 60% → 30%", "Overtaken by X") instead of a
 * generic alert row.
 */

export interface SovPayload {
  previousSov?: number | null;
  currentSov?: number | null;
  sovDelta?: number | null;
  overtakenBy?: { entity: string; previousSov?: number; currentSov?: number } | null;
  kind?: string;
}

export function isSovAlert(alert: OrgAlert): boolean {
  return alert?.type === "ai_sov";
}

const fmtPct = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : null;

/** "SoV 60% → 30%" when both values are present, otherwise null. */
export function sovShiftText(alert: OrgAlert): string | null {
  if (!isSovAlert(alert)) return null;
  const p = (alert.payload || {}) as SovPayload;
  const prev = fmtPct(p.previousSov);
  const cur = fmtPct(p.currentSov);
  if (prev == null || cur == null) return null;
  return `SoV ${prev} → ${cur}`;
}

/** "Overtaken by X" when a competitor overtake is part of the alert, otherwise null. */
export function sovOvertakenText(alert: OrgAlert): string | null {
  if (!isSovAlert(alert)) return null;
  const p = (alert.payload || {}) as SovPayload;
  return p.overtakenBy?.entity ? `Overtaken by ${p.overtakenBy.entity}` : null;
}

export interface AlertTypeMeta {
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/** Distinct label + icon per alert type so SoV alerts aren't confused with spike ones. */
export function alertTypeMeta(alert: OrgAlert): AlertTypeMeta {
  switch (alert?.type) {
    case "ai_sov":
      return { label: "SoV Shift", icon: "pie-chart" };
    case "ai_narrative":
      return { label: "AI Narrative", icon: "cpu" };
    case "sentiment":
      return { label: "Sentiment", icon: "alert-circle" };
    default:
      return { label: "Spike", icon: "trending-up" };
  }
}

/** Human-readable title derived from the alert row (rows have no title column). */
export function alertTitle(alert: OrgAlert): string {
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

/** Human-readable one-line description of the alert (null when nothing useful). */
export function alertDescription(alert: OrgAlert): string | null {
  if (isSovAlert(alert)) {
    const parts: string[] = [];
    const shift = sovShiftText(alert);
    if (shift) parts.push(shift);
    const overtaken = sovOvertakenText(alert);
    if (overtaken) {
      const p = (alert.payload || {}) as SovPayload;
      const compCur = fmtPct(p.overtakenBy?.currentSov);
      parts.push(`${overtaken}${compCur ? ` (now at ${compCur})` : ""}`);
    }
    if (parts.length) return parts.join(" · ");
    return "AI share of voice alert";
  }
  if (alert?.type === "ai_narrative" && alert.sentimentShift != null) {
    return `AI sentiment shift: ${Number(alert.sentimentShift).toFixed(2)}`;
  }
  if (alert?.crisisProbability != null) {
    return `Crisis probability: ${Math.round(Number(alert.crisisProbability))}%`;
  }
  return null;
}
