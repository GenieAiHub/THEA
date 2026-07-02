import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setAuthToken } from "@/lib/api";
import {
  authenticateBiometric,
  biometricLabel,
  getBiometricSupport,
} from "@/lib/biometric";
import { storage } from "@/lib/storage";
import type { AuthOrg, AuthUser } from "@/lib/types";

const TOKEN_KEY = "theaAccessToken";
const BIOMETRIC_KEY = "theaBiometricEnabled";

type AuthStatus = "loading" | "authed" | "unauthed" | "locked";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  org: AuthOrg | null;
  canManage: boolean;
  /** Device has usable biometric hardware with an enrolled identity. */
  biometricSupported: boolean;
  /** User has opted in to biometric unlock on this device. */
  biometricEnabled: boolean;
  /** Human label for the device biometric (Face ID / Touch ID / ...). */
  biometricLabel: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Prompt biometric auth to reveal a locked session. */
  unlock: () => Promise<boolean>;
  /** Opt in to biometric unlock (prompts once to confirm). */
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("biometrics");

  const loadSession = useCallback(async () => {
    const me = await api.me();
    setUser(me.user);
    setOrg(me.org);
    setStatus("authed");
  }, []);

  const applySession = useCallback(
    async (token: string) => {
      await storage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
      await loadSession();
    },
    [loadSession],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const support = await getBiometricSupport();
      const enabledFlag = (await storage.getItem(BIOMETRIC_KEY)) === "1";
      if (!cancelled) {
        setBiometricSupported(support.available);
        setBioLabel(biometricLabel(support.types));
        setBiometricEnabled(enabledFlag && support.available);
      }

      try {
        const token = await storage.getItem(TOKEN_KEY);
        if (!token) {
          if (!cancelled) setStatus("unauthed");
          return;
        }
        setAuthToken(token);
        // A stored token behind biometric opt-in stays locked until the user
        // authenticates; we don't load the session or reveal the app yet.
        if (enabledFlag && support.available) {
          if (!cancelled) setStatus("locked");
          return;
        }
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
  }, [loadSession]);

  const unlock = useCallback(async () => {
    const ok = await authenticateBiometric(`Unlock THEA with ${bioLabel}`);
    if (!ok) return false;
    try {
      await loadSession();
      return true;
    } catch {
      // Token no longer valid — drop it and send the user back to sign-in.
      await storage.deleteItem(TOKEN_KEY).catch(() => {});
      setAuthToken(null);
      setStatus("unauthed");
      return false;
    }
  }, [bioLabel, loadSession]);

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

  const enableBiometric = useCallback(async () => {
    const support = await getBiometricSupport();
    if (!support.available) return false;
    const label = biometricLabel(support.types);
    const ok = await authenticateBiometric(`Enable ${label} for THEA`);
    if (!ok) return false;
    await storage.setItem(BIOMETRIC_KEY, "1");
    setBiometricSupported(true);
    setBiometricEnabled(true);
    setBioLabel(label);
    return true;
  }, []);

  const disableBiometric = useCallback(async () => {
    await storage.deleteItem(BIOMETRIC_KEY);
    setBiometricEnabled(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      org,
      canManage: user?.role === "owner" || user?.role === "admin",
      biometricSupported,
      biometricEnabled,
      biometricLabel: bioLabel,
      login,
      register,
      logout,
      unlock,
      enableBiometric,
      disableBiometric,
    }),
    [
      status,
      user,
      org,
      biometricSupported,
      biometricEnabled,
      bioLabel,
      login,
      register,
      logout,
      unlock,
      enableBiometric,
      disableBiometric,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
