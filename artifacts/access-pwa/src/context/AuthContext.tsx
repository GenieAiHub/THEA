import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  ApiError,
} from "@workspace/api-client-react";
import type { AuthOrg, AuthUser } from "@/lib/types";
import { storage } from "@/lib/storage";
import { purgePersistedQueryCache } from "@/lib/queryClient";
import {
  clearBiometric,
  enrollBiometric,
  hasBiometricCredential,
  isBiometricAvailable,
  verifyBiometric,
} from "@/lib/biometric";

const BIOMETRIC_FLAG = "thea.biometric.enabled";
const SNAPSHOT_KEY = "thea.access.session";

type Status = "loading" | "authed" | "unauthed" | "locked";

/**
 * Device-local snapshot of the last confirmed session. It lets the app boot
 * straight into the (locked or authed) shell while offline, before falling back
 * to the login screen. It is cleared on logout and on a confirmed 401.
 */
interface SessionSnapshot {
  user: AuthUser;
  org: AuthOrg;
  tier: string;
  featureFlags: string[];
}

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  org: AuthOrg | null;
  tier: string | null;
  featureFlags: string[];
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

function readSnapshot(): SessionSnapshot | null {
  const raw = storage.get(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(s: SessionSnapshot): void {
  storage.set(SNAPSHOT_KEY, JSON.stringify(s));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [org, setOrg] = useState<AuthOrg | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<string[]>([]);
  const [biometricEnabled, setBiometricEnabled] = useState(
    () => storage.get(BIOMETRIC_FLAG) === "1" && hasBiometricCredential(),
  );
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const applySession = useCallback((data: SessionSnapshot) => {
    setUser(data.user);
    setOrg(data.org);
    setTier(data.tier);
    setFeatureFlags(data.featureFlags ?? []);
  }, []);

  const clearLocalSession = useCallback(async () => {
    clearBiometric();
    storage.remove(BIOMETRIC_FLAG);
    storage.remove(SNAPSHOT_KEY);
    setBiometricEnabled(false);
    setUser(null);
    setOrg(null);
    setTier(null);
    setFeatureFlags([]);
    await purgePersistedQueryCache();
    setStatus("unauthed");
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await authMe();
    applySession(data);
    writeSnapshot(data);
  }, [applySession]);

  const revalidate = useCallback(async () => {
    try {
      const { data } = await authMe();
      applySession(data);
      writeSnapshot(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearLocalSession();
      }
      // Any other error (still offline / transient) keeps the cached session.
    }
  }, [applySession, clearLocalSession]);

  const bootstrap = useCallback(async () => {
    const enterFromSession = () => {
      const wantsLock =
        storage.get(BIOMETRIC_FLAG) === "1" && hasBiometricCredential();
      setBiometricEnabled(wantsLock);
      setStatus(wantsLock ? "locked" : "authed");
    };

    try {
      const { data } = await authMe();
      applySession(data);
      writeSnapshot(data);
      enterFromSession();
    } catch (err) {
      if (err instanceof ApiError) {
        // The server answered, so we're online. A 401 means there is no valid
        // session — drop any cached snapshot and show the login screen.
        if (err.status === 401) {
          storage.remove(SNAPSHOT_KEY);
          await purgePersistedQueryCache();
        }
        setStatus("unauthed");
        return;
      }
      // Network failure (offline): fall back to the cached snapshot so the app
      // is usable, and revalidate once connectivity returns.
      const snapshot = readSnapshot();
      if (snapshot) {
        applySession(snapshot);
        enterFromSession();
        window.addEventListener("online", () => void revalidate(), {
          once: true,
        });
      } else {
        setStatus("unauthed");
      }
    }
  }, [applySession, revalidate]);

  useEffect(() => {
    void bootstrap();
    void isBiometricAvailable().then(setBiometricAvailable);
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authLogin({ email, password });
      // Drop any previous user's cached data before the new session loads.
      await purgePersistedQueryCache();
      await refresh();
      setStatus("authed");
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string, name: string | null) => {
      await authRegister({ email, password, name: name ?? undefined });
      await purgePersistedQueryCache();
      await refresh();
      setStatus("authed");
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch {
      /* ignore — clear locally regardless */
    }
    await clearLocalSession();
  }, [clearLocalSession]);

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
    if (ok) {
      setStatus("authed");
      // Best-effort session check when online; offline keeps cached data.
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void revalidate();
      }
    }
    return ok;
  }, [revalidate]);

  const unlockWithPassword = useCallback(
    async (password: string) => {
      if (!user) throw new Error("Session expired. Please sign in.");
      await authLogin({ email: user.email, password });
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
