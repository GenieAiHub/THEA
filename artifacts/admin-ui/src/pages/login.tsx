import { useState } from "react";
import { setToken } from "@/lib/auth";
import { adminFetch } from "@/hooks/use-admin";

export default function Login() {
  const [token, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      setToken(token.trim());
      await adminFetch("/stats");
      window.location.reload();
    } catch {
      setError("Invalid token — access denied.");
      import("@/lib/auth").then(({ clearToken }) => clearToken());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="font-mono font-bold text-3xl text-primary tracking-tight mb-1">
            THEA<span className="text-muted-foreground">_OP</span>
          </div>
          <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
            Super Admin Console
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-border bg-card rounded-sm p-8 space-y-6"
        >
          <div className="space-y-1">
            <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-4">
              Authentication Required
            </div>
            <label className="block text-xs font-mono text-muted-foreground mb-2">
              Admin Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="thea_admin_..."
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-destructive border border-destructive/30 bg-destructive/10 rounded-sm px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full bg-primary text-primary-foreground font-mono text-sm py-2 rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Verifying..." : "Authenticate"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs font-mono text-muted-foreground/40">
          Unauthorized access is prohibited and logged.
        </div>
      </div>
    </div>
  );
}
