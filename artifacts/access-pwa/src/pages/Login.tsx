import { useState } from "react";
import { Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

type Mode = "login" | "register";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim() || null);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
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
            <ScanFace className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">THEA Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to manage access for your organization"
              : "Create your organization to get started"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                data-testid="input-name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="input-password"
            />
          </div>

          {error && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="text-auth-error"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base"
            disabled={busy}
            data-testid="button-submit-auth"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create organization"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              New to THEA?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                data-testid="button-switch-register"
              >
                Create an organization
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                data-testid="button-switch-login"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}
