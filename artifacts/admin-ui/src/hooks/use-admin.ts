import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, clearToken } from "@/lib/auth";

const getBaseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getBaseUrl()}/api/v1/admin${path}`, { ...options, headers });
  
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
