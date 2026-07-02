import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Loader2, CreditCard, Wallet, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCheckout } from "@/hooks/use-checkout";

const logoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`;

interface PlanInfo {
  name: string;
  priceMonthly: number;
  priceAnnual: number; // discounted per-month price
}

const PLAN_INFO: Record<string, PlanInfo> = {
  professional: { name: "Professional", priceMonthly: 99, priceAnnual: 79 },
  business: { name: "Business", priceMonthly: 499, priceAnnual: 399 },
  political: { name: "Political Party", priceMonthly: 1999, priceAnnual: 1599 },
};

interface BillingConfig {
  card: boolean;
  paypal: boolean;
  paypalClientId: string | null;
  crypto: boolean;
  cryptoChain: string | null;
}

interface CryptoIntent {
  intentId: string;
  chain: string;
  token: string;
  tokenAddress: string;
  receivingAddress: string;
  amount: string;
  decimals: number;
  minConfirmations: number;
  expiresAt: string;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

function loadPaypalSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-thea-paypal]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    script.dataset.theaPaypal = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { startCheckout, isCheckoutLoading } = useCheckout();

  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const planKey = searchParams.get("plan") ?? "";
  const interval = searchParams.get("interval") === "monthly" ? "monthly" : "annual";
  const plan = PLAN_INFO[planKey];

  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/billing/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("config"))))
      .then((body) => {
        if (!cancelled) setConfig(body.data as BillingConfig);
      })
      .catch(() => {
        if (!cancelled) setConfigError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!plan) return <Redirect to="/pricing" />;

  const perMonth = interval === "annual" ? plan.priceAnnual : plan.priceMonthly;
  const chargeNow = interval === "annual" ? plan.priceAnnual * 12 : plan.priceMonthly;

  const availableMethods = config
    ? [config.card && "card", config.paypal && "paypal", config.crypto && "crypto"].filter(Boolean) as string[]
    : [];
  const defaultMethod = availableMethods[0] ?? "card";

  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-200 flex flex-col items-center py-16 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl z-10">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img src={logoUrl} alt="THEA" className="w-12 h-12 cursor-pointer" />
          </Link>
        </div>

        {/* Order summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-400 font-semibold">Your plan</p>
              <h1 className="text-2xl font-display font-bold text-white mt-1">THEA {plan.name}</h1>
              <p className="text-sm text-slate-400 mt-1">
                ${perMonth.toLocaleString()}/mo · billed {interval === "annual" ? "annually" : "monthly"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">${chargeNow.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{interval === "annual" ? "per year" : "per month"}</p>
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Choose how to pay</h2>

          {!config && !configError && (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading payment options…
            </div>
          )}

          {configError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              We couldn't load payment options. Please refresh and try again.
            </div>
          )}

          {config && availableMethods.length === 0 && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
              Payments are being set up and will be available shortly. Please check back soon.
            </div>
          )}

          {config && availableMethods.length > 0 && (
            <Tabs defaultValue={defaultMethod} className="w-full">
              <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${availableMethods.length}, minmax(0, 1fr))` }}>
                {config.card && (
                  <TabsTrigger value="card" className="data-[state=active]:bg-slate-800">
                    <CreditCard className="w-4 h-4 mr-2" /> Card
                  </TabsTrigger>
                )}
                {config.paypal && (
                  <TabsTrigger value="paypal" className="data-[state=active]:bg-slate-800">
                    <Wallet className="w-4 h-4 mr-2" /> PayPal
                  </TabsTrigger>
                )}
                {config.crypto && (
                  <TabsTrigger value="crypto" className="data-[state=active]:bg-slate-800">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Crypto
                  </TabsTrigger>
                )}
              </TabsList>

              {config.card && (
                <TabsContent value="card">
                  <p className="text-sm text-slate-400 mb-4">
                    Pay securely by credit or debit card. You'll be redirected to our payment processor to
                    complete your purchase.
                  </p>
                  <Button
                    className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white"
                    disabled={isCheckoutLoading}
                    onClick={async () => {
                      const ok = await startCheckout(planKey, interval);
                      if (!ok) {
                        toast({ variant: "destructive", title: "Card checkout unavailable", description: "Please try another method." });
                      }
                    }}
                  >
                    {isCheckoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay $${chargeNow.toLocaleString()} by card`}
                  </Button>
                </TabsContent>
              )}

              {config.paypal && (
                <TabsContent value="paypal">
                  <PaypalPanel
                    planKey={planKey}
                    interval={interval}
                    clientId={config.paypalClientId}
                    onSuccess={() => setLocation("/dashboard?checkout=success")}
                  />
                </TabsContent>
              )}

              {config.crypto && (
                <TabsContent value="crypto">
                  <CryptoPanel
                    planKey={planKey}
                    interval={interval}
                    onSuccess={() => setLocation("/dashboard?checkout=success")}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}

          <p className="text-center text-xs text-slate-500 mt-6">
            <Link href="/pricing" className="text-slate-400 hover:text-slate-300">
              ← Back to pricing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function PaypalPanel({
  planKey,
  interval,
  clientId,
  onSuccess,
}: {
  planKey: string;
  interval: string;
  clientId: string | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) {
      setError("PayPal is not configured.");
      return;
    }
    let cancelled = false;
    loadPaypalSdk(clientId)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load PayPal. Please try another method.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!ready || !window.paypal || !containerRef.current) return;
    containerRef.current.innerHTML = "";
    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
      createOrder: async () => {
        const res = await fetch("/api/v1/billing/paypal/order", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planKey, interval }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Could not start PayPal checkout");
        }
        const { orderId } = await res.json();
        return orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        const res = await fetch("/api/v1/billing/paypal/capture", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast({ variant: "destructive", title: "Payment failed", description: body?.error || "Please try again." });
          return;
        }
        toast({ title: "Payment successful", description: "Your subscription is now active." });
        onSuccess();
      },
      onError: () => {
        toast({ variant: "destructive", title: "PayPal error", description: "Something went wrong. Please try again." });
      },
    });
    buttons.render(containerRef.current).catch(() => {
      setError("Could not display PayPal buttons.");
    });
    return () => {
      try {
        buttons.close?.();
      } catch {
        /* noop */
      }
    };
  }, [ready, planKey, interval, onSuccess, toast]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">Approve the payment in the PayPal window to activate your plan.</p>
      {!ready && (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading PayPal…
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}

function CryptoPanel({
  planKey,
  interval,
  onSuccess,
}: {
  planKey: string;
  interval: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [intent, setIntent] = useState<CryptoIntent | null>(null);
  const [creating, setCreating] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pendingReason, setPendingReason] = useState<string | null>(null);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  const createIntent = async () => {
    setCreating(true);
    setPendingReason(null);
    try {
      const res = await fetch("/api/v1/billing/crypto/intent", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planKey, interval }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not start crypto payment");
      }
      const body = await res.json();
      setIntent(body.data as CryptoIntent);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Crypto unavailable",
        description: err instanceof Error ? err.message : "Please try another method.",
      });
    } finally {
      setCreating(false);
    }
  };

  const verify = async () => {
    if (!intent) return;
    const trimmed = txHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      toast({ variant: "destructive", title: "Invalid hash", description: "Enter the full transaction hash (0x…)." });
      return;
    }
    setVerifying(true);
    setPendingReason(null);
    try {
      const res = await fetch("/api/v1/billing/crypto/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: intent.intentId, txHash: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        toast({ title: "Payment confirmed", description: "Your subscription is now active." });
        onSuccess();
        return;
      }
      if (res.status === 202) {
        setPendingReason(body?.reason || "Transaction not confirmed yet. Please wait and try again.");
        return;
      }
      throw new Error(body?.error || "Verification failed");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not verify payment",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (!intent) {
    return (
      <div>
        <p className="text-sm text-slate-400 mb-4">
          Pay with USDT (Tether). We'll generate a unique payment amount so we can match your transaction
          on-chain.
        </p>
        <Button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white" disabled={creating} onClick={createIntent}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay with USDT"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 space-y-3">
        <Field label="Network" value={`${intent.chain.toUpperCase()} · ${intent.token}`} />
        <CopyField label="Send exactly" value={intent.amount} suffix="USDT" onCopy={() => copy(intent.amount, "Amount")} highlight />
        <CopyField label="To address" value={intent.receivingAddress} onCopy={() => copy(intent.receivingAddress, "Address")} mono />
        <p className="text-xs text-amber-300/90">
          Send the <strong>exact</strong> amount shown (the last digits identify your payment). Sending a
          different amount or token will not be detected.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="txhash" className="text-slate-300">
          Transaction hash
        </Label>
        <Input
          id="txhash"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x…"
          className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 font-mono text-sm"
        />
        <p className="text-xs text-slate-500">
          After sending, paste the transaction hash from your wallet. Confirmation may take a few minutes
          ({intent.minConfirmations} blocks).
        </p>
      </div>

      {pendingReason && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          {pendingReason}
        </div>
      )}

      <Button className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white" disabled={verifying} onClick={verify}>
        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "I've sent it — verify payment"}
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-200 font-medium">{value}</span>
    </div>
  );
}

function CopyField({
  label,
  value,
  suffix,
  onCopy,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  onCopy: () => void;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <code
          className={`flex-1 truncate rounded bg-slate-900 border border-slate-800 px-2 py-1.5 ${
            mono ? "font-mono text-xs" : "text-sm"
          } ${highlight ? "text-blue-300 font-semibold" : "text-slate-200"}`}
        >
          {value}
          {suffix ? ` ${suffix}` : ""}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded border border-slate-700 p-1.5 text-slate-400 hover:text-white hover:border-slate-500"
          aria-label={`Copy ${label}`}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
