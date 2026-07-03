import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import type { AuthOrg, AuthUser } from "@/lib/types";
import { storage } from "@/lib/storage";
import {
  clearBiometric,
  enrollBiometric,
  hasBiometricCredential,
  isBiometricAvailable,
  verifyBiometric,
} from "@/lib/biometric";

const BIOMETRIC_FLAG = "thea.biometric.enabled";

type Status = "loading" | "authed" | "unauthed" | "locked";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  org: AuthOrg | null;
  tier: string | null;
  featureFlags: Record<string, boolean>;
  canManage: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string | null,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  unlockWithBiometric: () => Promise<boolean>;
  unlockWithPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [biometricEnabled, setBiometricEnabled] = useState(
    () => storage.get(BIOMETRIC_FLAG) === "1" && hasBiometricCredential(),
  );
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const applySession = useCallback(
    (data: {
      user: AuthUser;
      org: AuthOrg;
      tier: string;
      featureFlags: Record<string, boolean>;
    }) => {
      setUser(data.user);
      setOrg(data.org);
      setTier(data.tier);
      setFeatureFlags(data.featureFlags ?? {});
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    try {
      const me = await api.me();
      applySession(me);
      const wantsLock =
        storage.get(BIOMETRIC_FLAG) === "1" && hasBiometricCredential();
      setBiometricEnabled(wantsLock);
      setStatus(wantsLock ? "locked" : "authed");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStatus("unauthed");
      } else {
        // Offline or transient: without a confirmed session we can't reveal
        // protected data. Treat as signed out; the login screen handles retry.
        setStatus("unauthed");
      }
    }
  }, [applySession]);

  useEffect(() => {
    void bootstrap();
    void isBiometricAvailable().then(setBiometricAvailable);
  }, [bootstrap]);

  const refresh = useCallback(async () => {
    const me = await api.me();
    applySession(me);
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      await refresh();
      setStatus("authed");
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string, name: string | null) => {
      await api.register(email, password, name);
      await refresh();
      setStatus("authed");
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore — clear locally regardless */
    }
    clearBiometric();
    storage.remove(BIOMETRIC_FLAG);
    setBiometricEnabled(false);
    setUser(null);
    setOrg(null);
    setTier(null);
    setFeatureFlags({});
    setStatus("unauthed");
  }, []);

  const enableBiometric = useCallback(async () => {
    if (!user) return false;
    const ok = await enrollBiometric({
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
    });
    if (ok) {
      storage.set(BIOMETRIC_FLAG, "1");
      setBiometricEnabled(true);
    }
    return ok;
  }, [user]);

  const disableBiometric = useCallback(() => {
    clearBiometric();
    storage.remove(BIOMETRIC_FLAG);
    setBiometricEnabled(false);
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await verifyBiometric();
    if (ok) setStatus("authed");
    return ok;
  }, []);

  const unlockWithPassword = useCallback(
    async (password: string) => {
      if (!user) throw new ApiError(401, "Session expired. Please sign in.");
      await api.login(user.email, password);
      await refresh();
      setStatus("authed");
    },
    [user, refresh],
  );

  const canManage = useMemo(
    () => user?.role === "owner" || user?.role === "admin",
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      org,
      tier,
      featureFlags,
      canManage,
      biometricEnabled,
      biometricAvailable,
      login,
      register,
      logout,
      refresh,
      enableBiometric,
      disableBiometric,
      unlockWithBiometric,
      unlockWithPassword,
    }),
    [
      status,
      user,
      org,
      tier,
      featureFlags,
      canManage,
      biometricEnabled,
      biometricAvailable,
      login,
      register,
      logout,
      refresh,
      enableBiometric,
      disableBiometric,
      unlockWithBiometric,
      unlockWithPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
