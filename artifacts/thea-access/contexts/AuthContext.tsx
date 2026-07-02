import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setAuthToken } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { AuthOrg, AuthUser } from "@/lib/types";

const TOKEN_KEY = "theaAccessToken";

type AuthStatus = "loading" | "authed" | "unauthed";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  org: AuthOrg | null;
  canManage: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);

  const applySession = useCallback(async (token: string) => {
    await storage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    const me = await api.me();
    setUser(me.user);
    setOrg(me.org);
    setStatus("authed");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storage.getItem(TOKEN_KEY);
        if (!token) {
          if (!cancelled) setStatus("unauthed");
          return;
        }
        setAuthToken(token);
        const me = await api.me();
        if (cancelled) return;
        setUser(me.user);
        setOrg(me.org);
        setStatus("authed");
      } catch {
        if (cancelled) return;
        await storage.deleteItem(TOKEN_KEY).catch(() => {});
        setAuthToken(null);
        setStatus("unauthed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.login(email, password);
      await applySession(session.token);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const session = await api.register(email, password, name.trim() || null);
      await applySession(session.token);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    await storage.deleteItem(TOKEN_KEY).catch(() => {});
    setAuthToken(null);
    setUser(null);
    setOrg(null);
    setStatus("unauthed");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      org,
      canManage: user?.role === "owner" || user?.role === "admin",
      login,
      register,
      logout,
    }),
    [status, user, org, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
