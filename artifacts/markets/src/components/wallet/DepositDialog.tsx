import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWeb3 } from "@/context/Web3Context";
import { ConnectWalletModal } from "./ConnectWalletModal";
import {
  useCreateIntent,
  useDepositCoins,
  useDepositHistory,
  useVerifyDeposit,
  type DepositChain,
  type DepositCoin,
  type DepositCoinId,
  type DepositHistoryItem,
  type DepositIntent,
} from "@/hooks/use-deposit";
import { chainLabel, explorerTxUrl, isEvmChain, sendDeposit } from "@/lib/web3/chains";

const PENDING_KEY = "thea.markets.deposit.pending";
// Block a fresh send once the intent is within this window of expiry, prompting
// a new request. The backend keeps a long grace window, so this is UX-only.
const MIN_REMAINING_MS = 2 * 60 * 1000;

type Phase = "form" | "instructions" | "verifying" | "done";

interface PendingDeposit {
  intent: DepositIntent;
  txHash: string;
}

function coinSymbol(coin: string): string {
  if (coin === "btc") return "BTC";
  if (coin === "eth") return "ETH";
  if (coin === "bsc_usdt") return "USDT";
  if (coin === "cg") return "CG";
  return coin.toUpperCase();
}

// Reconstruct just enough of an intent to resume the verifying view from a
// server-side pending record (used when the local pending record was lost).
// The verifying phase only reads intentId, coin, chain and expiresAt.
function synthIntent(h: DepositHistoryItem): DepositIntent {
  return {
    intentId: h.id,
    coin: h.coin as DepositCoinId,
    chain: h.chain as DepositChain,
    kind: "native",
    tokenAddress: null,
    receivingAddress: "",
    amount: h.amount,
    amountBaseUnits: "",
    decimals: 0,
    priceUsd: "",
    requestedUsd: h.requestedUsd,
    minConfirmations: 0,
    expiresAt: h.expiresAt,
  };
}

function loadPending(): PendingDeposit | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingDeposit) : null;
  } catch {
    return null;
  }
}
function savePending(p: PendingDeposit) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <button
        onClick={copy}
        className="flex items-center gap-2 w-full rounded-lg border border-primary/15 bg-secondary/30 px-3 py-2 text-left hover:bg-primary/10 transition-colors"
      >
        <span className="flex-1 min-w-0 text-sm text-white font-mono break-all">{value}</span>
        {copied ? (
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositDialog({ open, onOpenChange }: Props) {
  const { isSignedIn } = useAuth();
  const { account, provider, wallet, isConnected } = useWeb3();

  const coinsQuery = useDepositCoins(open && isSignedIn);
  const historyQuery = useDepositHistory(open && isSignedIn);
  const createIntent = useCreateIntent();
  const verify = useVerifyDeposit();

  // Guards a one-shot auto-resume per dialog open so it never fights the user
  // after they explicitly start a new deposit.
  const autoResumedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("form");
  const [coinId, setCoinId] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [manualTxHash, setManualTxHash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<string>("");
  const [credited, setCredited] = useState<string>("");
  const [newBalance, setNewBalance] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Bumped to (re)start verification polling after a terminal error.
  const [pollNonce, setPollNonce] = useState(0);

  const coins = coinsQuery.data ?? [];
  const selectedCoin: DepositCoin | undefined = useMemo(
    () => coins.find((c) => c.coin === coinId),
    [coins, coinId],
  );

  // On open: restore an in-progress deposit if one is pending, else start fresh.
  useEffect(() => {
    if (!open) return;
    autoResumedRef.current = false;
    const pending = loadPending();
    if (pending) {
      autoResumedRef.current = true;
      setIntent(pending.intent);
      setTxHash(pending.txHash);
      setPhase("verifying");
      setPendingReason("Checking the network for your transaction…");
    } else {
      setPhase("form");
      setIntent(null);
      setTxHash("");
      setManualTxHash("");
      setCredited("");
      setNewBalance("");
      setPendingReason("");
    }
    setError(null);
  }, [open]);

  // Fallback resume: if the local pending record was lost (cleared, or a
  // different browser), recover an in-flight deposit from the server. The API
  // now persists the submitted tx hash on the still-pending intent, so a real
  // on-chain transfer is never stranded without a UI path to credit it.
  useEffect(() => {
    if (!open || autoResumedRef.current) return;
    if (phase !== "form" || intent) return;
    const items = historyQuery.data;
    if (!items) return;
    const graceMs = 24 * 60 * 60 * 1000;
    const resumable = items.find(
      (h) =>
        h.status === "pending" &&
        !!h.txHash &&
        Date.now() < new Date(h.expiresAt).getTime() + graceMs,
    );
    if (!resumable || !resumable.txHash) return;
    autoResumedRef.current = true;
    setIntent(synthIntent(resumable));
    setTxHash(resumable.txHash);
    setPendingReason("Resuming your pending deposit…");
    setError(null);
    setPhase("verifying");
  }, [open, phase, intent, historyQuery.data]);

  // Countdown ticker (only while an intent is on screen).
  useEffect(() => {
    if (!open || !intent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, intent]);

  const remainingMs = intent ? new Date(intent.expiresAt).getTime() - now : 0;
  const expired = !!intent && remainingMs <= MIN_REMAINING_MS;

  // Poll verification while in the verifying phase.
  useEffect(() => {
    if (phase !== "verifying" || !intent || !txHash) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 12_000;

    const poll = async () => {
      try {
        const r = await verify.mutateAsync({ intentId: intent.intentId, txHash });
        if (!active) return;
        if (r.status === "confirmed") {
          setCredited(r.creditedUsd);
          setNewBalance(r.balance);
          setPhase("done");
          clearPending();
          return;
        }
        setError(null);
        setPendingReason(r.reason);
        backoff = 12_000;
        timer = setTimeout(poll, backoff);
      } catch (e) {
        if (!active) return;
        // A network hiccup must NOT strand real on-chain funds: keep the pending
        // record and keep retrying (with backoff). Only a definitive API error
        // (expired past grace, ambiguous, etc.) surfaces as a stop-and-ask error.
        const transient =
          e instanceof TypeError ||
          /fetch|network|load failed|failed to fetch/i.test(
            e instanceof Error ? e.message : "",
          );
        if (transient) {
          setPendingReason("Network issue — still trying to confirm your deposit…");
          backoff = Math.min(backoff * 2, 60_000);
          timer = setTimeout(poll, backoff);
        } else {
          setError(e instanceof Error ? e.message : "Verification failed");
        }
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
    // verify.mutateAsync is stable; intent + txHash + phase + pollNonce drive re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, intent, txHash, pollNonce]);

  const handleCreateIntent = useCallback(async () => {
    setError(null);
    if (!selectedCoin) {
      setError("Please choose a coin");
      return;
    }
    const usd = Number(amountUsd);
    if (!Number.isFinite(usd) || usd < 1) {
      setError("Enter an amount of at least $1");
      return;
    }
    if (usd > 100_000) {
      setError("The maximum single deposit is $100,000");
      return;
    }
    try {
      const created = await createIntent.mutateAsync({
        coin: selectedCoin.coin,
        amountUsd: String(Math.floor(usd)),
      });
      setIntent(created);
      setNow(Date.now());
      setPhase("instructions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the deposit request");
    }
  }, [selectedCoin, amountUsd, createIntent]);

  const handleSend = useCallback(async () => {
    if (!intent || !isEvmChain(intent.chain)) return;
    if (!provider || !account) {
      setWalletModalOpen(true);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const hash = await sendDeposit({
        provider,
        from: account,
        chain: intent.chain,
        kind: intent.kind,
        receivingAddress: intent.receivingAddress,
        tokenAddress: intent.tokenAddress,
        amountBaseUnits: intent.amountBaseUnits,
      });
      setTxHash(hash);
      savePending({ intent, txHash: hash });
      setPendingReason("Transaction sent — waiting for confirmations…");
      setPhase("verifying");
    } catch (e) {
      const err = e as { code?: number; message?: string };
      if (err?.code === 4001) setError("You rejected the transaction in your wallet");
      else setError(err?.message || "The transaction could not be sent");
    } finally {
      setSending(false);
    }
  }, [intent, provider, account]);

  const handleManualVerify = useCallback(() => {
    if (!intent) return;
    const h = manualTxHash.trim();
    if (!h) {
      setError("Paste the transaction hash from your wallet");
      return;
    }
    setError(null);
    setTxHash(h);
    savePending({ intent, txHash: h });
    setPendingReason("Checking the network for your transaction…");
    setPhase("verifying");
  }, [intent, manualTxHash]);

  const startOver = () => {
    // The user explicitly abandoned this request — don't let the server-side
    // fallback resume immediately pull it back onto the screen.
    autoResumedRef.current = true;
    clearPending();
    setPhase("form");
    setIntent(null);
    setTxHash("");
    setManualTxHash("");
    setError(null);
    setPendingReason("");
  };

  const retryVerify = () => {
    setError(null);
    setPendingReason("Checking the network for your transaction…");
    setPollNonce((n) => n + 1);
  };

  const mins = Math.max(0, Math.floor(remainingMs / 60000));
  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Deposit crypto
            </DialogTitle>
            <DialogDescription>
              Fund your Markets balance with a real crypto transfer.
            </DialogDescription>
          </DialogHeader>

          {!isSignedIn ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Sign in to your Markets account to make a deposit.
              </p>
              <Button asChild onClick={() => onOpenChange(false)}>
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          ) : phase === "form" ? (
            <div className="flex flex-col gap-4 mt-1">
              {coinsQuery.isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : coins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No deposit currencies are available yet. Please check back soon.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Choose a coin</p>
                    <div className="grid grid-cols-2 gap-2">
                      {coins.map((c) => (
                        <button
                          key={c.coin}
                          onClick={() => setCoinId(c.coin)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            coinId === c.coin
                              ? "border-primary bg-primary/10"
                              : "border-primary/15 bg-secondary/20 hover:bg-primary/5"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-white">
                            {coinSymbol(c.coin)}
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {chainLabel(c.chain)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Amount (USD)</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        value={amountUsd}
                        onChange={(e) => setAmountUsd(e.target.value)}
                        placeholder="100"
                        className="pl-7"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Min $1 · Max $100,000. Credited to your balance in USDT value.
                    </p>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <Button
                    onClick={handleCreateIntent}
                    disabled={createIntent.isPending || !coinId || !amountUsd}
                    className="w-full"
                  >
                    {createIntent.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : phase === "instructions" && intent ? (
            <div className="flex flex-col gap-4 mt-1">
              <button
                onClick={startOver}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white self-start"
              >
                <ArrowLeft className="w-3 h-3" /> Change amount
              </button>

              <div className="rounded-lg border border-primary/20 bg-secondary/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">You send</span>
                  <span className="text-sm font-semibold text-white">
                    {intent.amount} {coinSymbol(intent.coin)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <span className="text-sm text-white">{chainLabel(intent.chain)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">You get</span>
                  <span className="text-sm text-white">≈ ${intent.requestedUsd} USDT</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Request valid for</span>
                  <span className={`text-sm ${expired ? "text-destructive" : "text-white"}`}>
                    {countdown}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Send the <b>exact</b> amount on the <b>{chainLabel(intent.chain)}</b> network
                  only. A different amount or network cannot be credited automatically.
                </p>
              </div>

              {isEvmChain(intent.chain) ? (
                <>
                  {isConnected ? (
                    <p className="text-[11px] text-muted-foreground">
                      Sending from {wallet?.name ?? "your wallet"} ·{" "}
                      <span className="font-mono">
                        {account?.slice(0, 6)}…{account?.slice(-4)}
                      </span>
                    </p>
                  ) : null}

                  {expired ? (
                    <Button onClick={startOver} className="w-full" variant="secondary">
                      Request expired — start over
                    </Button>
                  ) : isConnected ? (
                    <Button onClick={handleSend} disabled={sending} className="w-full">
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        `Send ${intent.amount} ${coinSymbol(intent.coin)}`
                      )}
                    </Button>
                  ) : (
                    <Button onClick={() => setWalletModalOpen(true)} className="w-full">
                      Connect a wallet to send
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <CopyField label="Send to this address" value={intent.receivingAddress} />
                  <CopyField label="Exact amount" value={intent.amount} />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Paste your transaction ID after sending
                    </p>
                    <Input
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      placeholder="Transaction hash / TXID"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    onClick={handleManualVerify}
                    disabled={expired || !manualTxHash.trim()}
                    className="w-full"
                  >
                    {expired ? "Request expired — start over" : "I've sent it — verify"}
                  </Button>
                </>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : phase === "verifying" && intent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-white">Confirming your deposit</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {pendingReason || "Waiting for network confirmations…"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                This can take a few minutes. You can safely close this window — your balance
                updates automatically once confirmed.
              </p>
              {txHash && explorerTxUrl(intent.chain, txHash) && (
                <a
                  href={explorerTxUrl(intent.chain, txHash)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {error && (
                <div className="mt-2 w-full">
                  <p className="text-xs text-destructive mb-2">{error}</p>
                  <p className="text-[11px] text-muted-foreground mb-3 max-w-xs mx-auto">
                    If you already sent the transaction, your funds are safe — reopen this window
                    anytime to finish confirming. Only start over if you haven&apos;t sent anything.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={retryVerify}>
                      Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={startOver}>
                      Start a new deposit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : phase === "done" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <p className="text-base font-semibold text-white">Deposit confirmed</p>
              <p className="text-sm text-muted-foreground">
                ${credited} was added to your balance.
              </p>
              <p className="text-xs text-muted-foreground">
                New balance: <span className="text-white font-medium">${newBalance} USDT</span>
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="secondary" onClick={startOver}>
                  New deposit
                </Button>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConnectWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </>
  );
}
