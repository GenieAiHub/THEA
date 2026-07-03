import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, clearToken } from "@/lib/auth";

async function request(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.reload();
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error ?? body?.detail ?? detail;
    } catch { /* non-JSON body */ }
    throw new Error(detail || `API error: ${res.status}`);
  }

  // Some endpoints might return 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// Admin-scoped fetch — prefixes /api/v1/admin (org mgmt, configs, monitoring, scheduler).
export async function adminFetch(path: string, options: RequestInit = {}) {
  return request(`/api/v1/admin${path}`, options);
}

// Generic API fetch — hits any /api/v1 path with the operator token. Used for
// endpoints outside the /admin namespace that accept ADMIN_INTERNAL_TOKEN
// (e.g. /analysis/run, /crawler/trigger, /crawler/runs).
export async function apiFetch(path: string, options: RequestInit = {}) {
  return request(`/api/v1${path}`, options);
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminFetch("/stats"),
  });
}

export function useAdminConfigs() {
  return useQuery({
    queryKey: ["admin", "configs"],
    queryFn: () => adminFetch("/configs").then(res => res.data),
  });
}

export function useAdminUpsertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      adminFetch(`/configs/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "configs"] });
    },
  });
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => adminFetch("/orgs").then(res => res.data),
  });
}

export function useAdminOrg(id: string | null) {
  return useQuery({
    queryKey: ["admin", "orgs", id],
    queryFn: () => adminFetch(`/orgs/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useAdminSetOrgTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: string }) =>
      adminFetch(`/orgs/${id}/tier`, { method: "PATCH", body: JSON.stringify({ tier }) }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs", v.id] });
    },
  });
}

export function useAdminPauseOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      adminFetch(`/orgs/${id}/pause`, { method: "PATCH", body: JSON.stringify({ paused }) }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs", v.id] });
    },
  });
}

// ─── Monitoring ───────────────────────────────────────────────────────────────

export function useAdminMonitoring() {
  return useQuery({
    queryKey: ["admin", "monitoring"],
    queryFn: () => adminFetch("/monitoring").then((res) => res.data),
    refetchInterval: 15_000,
  });
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function useAdminScheduler() {
  return useQuery({
    queryKey: ["admin", "scheduler"],
    queryFn: () => adminFetch("/scheduler").then((res) => res.data),
  });
}

export function useReloadScheduler() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminFetch("/scheduler/reload", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "scheduler"] }),
  });
}

export function useTriggerAnalysis() {
  return useMutation({
    mutationFn: (data: { category?: string; windowHours?: number }) =>
      apiFetch("/analysis/run", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useTriggerCollection() {
  return useMutation({
    mutationFn: (data: { sourceType: string; category?: string; keyword?: string; urls?: string[] }) =>
      apiFetch("/crawler/trigger", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useCollectionRuns(limit = 25) {
  return useQuery({
    queryKey: ["admin", "collection-runs", limit],
    queryFn: () => adminFetch(`/collection-runs?limit=${limit}`).then((res) => res.data),
    refetchInterval: 20_000,
  });
}

export function useAdminUsage() {
  return useQuery({
    queryKey: ["admin", "llm-usage"],
    queryFn: () => adminFetch("/llm/usage").then(res => res.data),
  });
}

export function useAdminChat() {
  return useMutation({
    mutationFn: (data: { provider: string, model?: string, messages: any[] }) => adminFetch("/llm/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// ─── Markets ──────────────────────────────────────────────────────────────────

export function useAdminMarkets() {
  return useQuery({
    queryKey: ["admin", "markets"],
    queryFn: () => adminFetch("/markets").then((res) => res.data),
  });
}

export function useAdminMarketSettings() {
  return useQuery({
    queryKey: ["admin", "market-settings"],
    queryFn: () => adminFetch("/market-settings"),
  });
}

export function useAdminUpdateMarketSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      enabled?: boolean;
      frequencyMinutes?: number;
      topics?: string[];
      marketsPerRun?: number;
    }) =>
      adminFetch("/market-settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "market-settings"] });
    },
  });
}

export function useAdminCreateMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      question: string;
      description?: string;
      category: string;
      options: string[];
      closesAt?: string;
    }) =>
      adminFetch("/markets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
    },
  });
}

export function useAdminUpdateMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      question?: string;
      description?: string;
      category?: string;
      status?: string;
      resolvedOption?: number;
      closesAt?: string | null;
    }) =>
      adminFetch(`/markets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
    },
  });
}

export function useAdminDeleteMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminFetch(`/markets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
    },
  });
}

export function useAdminGenerateMarkets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminFetch("/markets/generate", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "market-settings"] });
    },
  });
}

// ─── Subscription plans ─────────────────────────────────────────────────────

export interface AdminPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tier: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanInput {
  key: string;
  name: string;
  description?: string | null;
  tier: string;
  priceMonthly?: number;
  priceAnnual?: number;
  features?: string[];
  active?: boolean;
  sortOrder?: number;
}

export function useAdminPlans() {
  return useQuery<AdminPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: () => adminFetch("/plans").then((res) => res.data),
  });
}

export function useAdminCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlanInput) =>
      adminFetch("/plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useAdminUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PlanInput> & { id: string }) =>
      adminFetch(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useAdminDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminFetch(`/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useAdminActivatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, planId, expiresAt }: { orgId: string; planId: string; expiresAt?: string | null }) =>
      adminFetch(`/orgs/${orgId}/activate-plan`, {
        method: "POST",
        body: JSON.stringify({ planId, expiresAt: expiresAt || null }),
      }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs", v.orgId] });
    },
  });
}
