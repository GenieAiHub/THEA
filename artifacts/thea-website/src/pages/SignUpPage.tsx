import { useState, useEffect, type FormEvent } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const logoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`;

const PLAN_NAMES: Record<string, string> = {
  professional: "Professional",
  business: "Business",
  political: "Political Party",
};

export default function SignUpPage() {
  const { isLoaded, isSignedIn, register } = useAuth();
  const [, setLocation] = useLocation();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Parse query params for checkout flow
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const planKey = searchParams.get("plan");
  const interval = searchParams.get("interval") || "annual";
  const planName = planKey ? PLAN_NAMES[planKey] : null;

  // Don't auto-redirect while a plan-driven signup+checkout is in flight —
  // register() flips isSignedIn true mid-flow, and an eager redirect here would
  // race (and beat) the checkout redirect. When a plan is selected we let
  // handleSubmit drive navigation instead.
  if (isLoaded && isSignedIn && !submitting && !planKey) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);

      // If there's a plan selected, send the new user to checkout to pick a
      // payment method (card / PayPal / crypto). Otherwise start onboarding.
      if (planKey) {
        setLocation(`/checkout?plan=${planKey}&interval=${interval}`);
      } else {
        setLocation("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false); // Only stop loading if it failed. If it succeeded and started checkout, keep loading state.
    }
  };

  const isWorking = submitting;

  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img src={logoUrl} alt="THEA" className="w-12 h-12 cursor-pointer" />
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-bold text-white">
              {planName ? `Create account for ${planName}` : "Get started with THEA"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {planName 
                ? `You're one step away from upgrading your intelligence capabilities.`
                : "Intelligence at the speed of narrative"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isWorking}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 text-base"
            >
              {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : (planName ? "Continue to Checkout" : "Create account")}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
