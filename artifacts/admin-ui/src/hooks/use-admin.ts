import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, clearToken } from "@/lib/auth";

export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api/v1/admin${path}`, { ...options, headers });
  
  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.reload();
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.statusText}`);
  }
  
  // Some endpoints might return 204 No Content
  if (res.status === 204) return null;
  return res.json();
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
