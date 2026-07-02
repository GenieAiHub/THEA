import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  onboardingCompletedAt: string | null;
}

interface SessionData {
  user: AuthUser;
  org: AuthOrg;
  tier: string;
  featureFlags: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  org: AuthOrg | null;
  tier: string | null;
  featureFlags: string[];
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const API_BASE = "/api/v1/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const applySession = useCallback((data: SessionData | null) => {
    setUser(data?.user ?? null);
    setOrg(data?.org ?? null);
    setTier(data?.tier ?? null);
    setFeatureFlags(data?.featureFlags ?? []);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
      if (res.ok) {
        const body = (await res.json()) as { data: SessionData };
        applySession(body.data);
      } else {
        applySession(null);
      }
    } catch {
      applySession(null);
    } finally {
      setIsLoaded(true);
    }
  }, [applySession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await parseError(res, "Invalid email or password"));
      queryClient.clear();
      await refresh();
    },
    [queryClient, refresh],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) throw new Error(await parseError(res, "Could not create your account"));
      queryClient.clear();
      await refresh();
    },
    [queryClient, refresh],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
    } finally {
      applySession(null);
      queryClient.clear();
    }
  }, [applySession, queryClient]);

  const value: AuthContextValue = {
    user,
    org,
    tier,
    featureFlags,
    isLoaded,
    isSignedIn: !!user,
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
