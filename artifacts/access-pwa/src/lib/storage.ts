/**
 * Thin, failure-tolerant wrapper over localStorage.
 *
 * Private-mode Safari and storage-quota errors throw on write, so every call
 * is guarded. Only device-local preferences (biometric opt-in, install-hint
 * dismissal) live here — the session itself is a first-party HttpOnly cookie
 * managed by the API.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return typeof window !== "undefined"
        ? window.localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  },
  remove(key: string): void {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  },
};
