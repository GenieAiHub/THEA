// Shared API helper + types for the THEA MMP portal (cookie-session auth, root-relative /api).

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/mmp${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface MmpApp {
  id: string;
  name: string;
  platform: string;
  ingestToken: string;
  createdAt: string;
}

export interface MmpLink {
  id: string;
  appId: string;
  name: string;
  channel: string;
  code: string;
  destinationUrl: string;
  deepLinkUrl: string | null;
  creatorId: string | null;
  createdAt: string;
}

export interface Creator {
  id: string;
  appId: string;
  name: string;
  platform: string;
  handle: string | null;
  createdAt: string;
}

export interface CreatorStats {
  creatorId: string;
  appId: string;
  name: string;
  platform: string;
  handle: string | null;
  clicks: number;
  installs: number;
  uninstalls: number;
  d1Retention: number | null;
  d7Retention: number | null;
  revenueUsd: number;
  ltvUsd: number | null;
}

export interface HealthIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

export interface HealthReport {
  appId: string;
  appName: string;
  score: number;
  status: string;
  windowDays: number;
  sample: { installs: number; events: number };
  issues: HealthIssue[];
}

export interface RetentionRow {
  week: string;
  installs: number;
  paid: number;
  organic: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

export interface LtvPoint {
  day: number;
  ltvUsd: number;
}

export interface CostRow {
  id: string;
  linkId: string;
  linkName: string;
  code: string;
  appId: string;
  day: string;
  costUsd: number;
}

export interface DebugRow {
  id: string;
  appId: string | null;
  kind: string;
  status: string;
  reason: string | null;
  payload: string | null;
  createdAt: string;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function fmtPct(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}
