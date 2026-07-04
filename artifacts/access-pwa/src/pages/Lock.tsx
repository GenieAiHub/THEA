import { useEffect, useState } from "react";
import { Fingerprint, Loader2, Lock as LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { biometricLabel } from "@/lib/biometric";
import { haptic } from "@/lib/haptics";
import { ApiError } from "@workspace/api-client-react";

export default function Lock() {
  const { user, unlockWithBiometric, unlockWithPassword, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tryBiometric = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await unlockWithBiometric();
      if (ok) {
        haptic("success");
      } else {
        haptic("error");
        setError("Couldn't verify. Try again or use your password.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Auto-prompt biometrics once on mount.
  useEffect(() => {
    void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await unlockWithPassword(password);
      haptic("success");
    } catch (err) {
      haptic("error");
      setError(
        err instanceof ApiError
          ? err.message
          : "Can't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="safe-top" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
            <LockIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.email ?? "Unlock to continue"}
          </p>
        </div>

        {!usePassword ? (
          <div className="space-y-4">
            <Button
              size="lg"
              className="h-14 w-full text-base"
              onClick={tryBiometric}
              disabled={busy}
              data-testid="button-unlock-biometric"
            >
              {busy ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-5 w-5" />
              )}
              Unlock with {biometricLabel()}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setUsePassword(true);
                setError(null);
              }}
              data-testid="button-use-password"
            >
              Use password instead
            </Button>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lock-password">Password</Label>
              <Input
                id="lock-password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="input-lock-password"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full"
              disabled={busy}
              data-testid="button-unlock-password"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unlock
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setUsePassword(false);
                setError(null);
              }}
            >
              Use biometrics instead
            </Button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-destructive">{error}</p>
        )}

        <button
          type="button"
          className="mt-8 text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => void logout()}
          data-testid="button-lock-signout"
        >
          Sign out
        </button>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}
