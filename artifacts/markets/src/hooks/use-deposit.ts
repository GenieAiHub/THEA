import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Cross-artifact API calls are root-relative so the shared proxy routes them to
// the API server (prepending BASE_URL would hit this app's own Vite server).
const BASE = "/api/v1/wallet";

async function errMsg(res: Response, fallback: string): Promise<string> {
  try {
    const b = await res.json();
    return typeof b?.error === "string" ? b.error : fallback;
  } catch {
    return fallback;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await errMsg(res, "Request failed"));
  const body = await res.json();
  return body.data as T;
}

export type DepositCoinId = "btc" | "eth" | "bsc_usdt" | "cg";
export type DepositChain = "bitcoin" | "ethereum" | "bsc";

export interface DepositCoin {
  coin: DepositCoinId;
  label: string;
  chain: DepositChain;
  kind: "native" | "erc20";
  decimals: number;
  minConfirmations: number;
  priceUsd: string;
}

export interface DepositIntent {
  intentId: string;
  coin: DepositCoinId;
  chain: DepositChain;
  kind: "native" | "erc20";
  tokenAddress: string | null;
  receivingAddress: string;
  amount: string;
  amountBaseUnits: string;
  decimals: number;
  priceUsd: string;
  requestedUsd: string;
  minConfirmations: number;
  expiresAt: string;
}

export interface WalletBalance {
  id: string;
  balance: string;
  balanceMicro: string;
  currency: string;
  updatedAt: string;
}

export interface DepositHistoryItem {
  id: string;
  coin: string;
  chain: string;
  amount: string;
  requestedUsd: string;
  status: string;
  txHash: string | null;
  creditedUsd: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export type VerifyResult =
  | { status: "confirmed"; creditedUsd: string; balance: string }
  | { status: "pending"; reason: string };

export function useWalletBalance(enabled: boolean) {
  return useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: () => apiGet<WalletBalance>("/"),
    enabled,
  });
}

export function useDepositCoins(enabled: boolean) {
  return useQuery({
    queryKey: ["wallet", "deposit", "coins"],
    queryFn: () => apiGet<DepositCoin[]>("/deposit/coins"),
    enabled,
    staleTime: 60_000,
  });
}

export function useDepositHistory(enabled: boolean) {
  return useQuery({
    queryKey: ["wallet", "deposit", "intents"],
    queryFn: () => apiGet<DepositHistoryItem[]>("/deposit/intents"),
    enabled,
  });
}

export function useCreateIntent() {
  return useMutation({
    mutationFn: async (input: { coin: string; amountUsd: string }): Promise<DepositIntent> => {
      const res = await fetch(`${BASE}/deposit/intent`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errMsg(res, "Could not create the deposit"));
      const body = await res.json();
      return body.data as DepositIntent;
    },
  });
}

export function useVerifyDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { intentId: string; txHash: string }): Promise<VerifyResult> => {
      const res = await fetch(`${BASE}/deposit/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}) as Record<string, unknown>);
      // 202 = accepted-but-not-yet-confirmed; body carries a human reason.
      if (res.status === 202 || body?.pending) {
        return { status: "pending", reason: (body?.reason as string) ?? "Waiting for confirmation" };
      }
      if (!res.ok) throw new Error((body?.error as string) ?? "Verification failed");
      return {
        status: "confirmed",
        creditedUsd: body.creditedUsd as string,
        balance: body.balance as string,
      };
    },
    onSuccess: (r) => {
      if (r.status === "confirmed") {
        qc.invalidateQueries({ queryKey: ["wallet", "balance"] });
        qc.invalidateQueries({ queryKey: ["wallet", "deposit", "intents"] });
      }
    },
  });
}
