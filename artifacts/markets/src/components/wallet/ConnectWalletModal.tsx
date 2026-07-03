import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useWeb3 } from "@/context/Web3Context";
import { getWalletAvailability, type WalletAvailability } from "@/lib/web3/wallets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletModal({ open, onOpenChange }: Props) {
  const { connect, connecting, walletId, isConnected } = useWeb3();
  const [avail, setAvail] = useState<WalletAvailability[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll availability while open — wallets can announce (EIP-6963) lazily.
  useEffect(() => {
    if (!open) return;
    const refresh = () => setAvail(getWalletAvailability());
    refresh();
    const t = setInterval(refresh, 800);
    return () => clearInterval(t);
  }, [open]);

  // Close automatically once a wallet connects.
  useEffect(() => {
    if (open && isConnected) onOpenChange(false);
  }, [open, isConnected, onOpenChange]);

  const handleClick = async (a: WalletAvailability) => {
    setError(null);
    if (!a.installed) {
      window.open(a.def.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setPendingId(a.def.id);
    try {
      await connect(a.def.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the wallet");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="font-display">Connect a wallet</DialogTitle>
          <DialogDescription>
            Pick a wallet to connect and fund your Markets balance with crypto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-1">
          {avail.map((a) => {
            const icon = a.discovered?.info.icon;
            const isPending = pendingId === a.def.id && connecting;
            const isActive = walletId === a.def.id && isConnected;
            return (
              <button
                key={a.def.id}
                onClick={() => handleClick(a)}
                disabled={isPending}
                className="flex items-center gap-3 w-full rounded-lg border border-primary/15 bg-secondary/20 hover:bg-primary/10 px-3 py-3 transition-colors text-left disabled:opacity-60"
              >
                {icon ? (
                  <img src={icon} alt="" className="w-8 h-8 rounded-md object-contain shrink-0" />
                ) : (
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: a.def.color }}
                  >
                    {a.def.short}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white">{a.def.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {a.installed ? "Detected" : "Not installed — get the extension"}
                  </span>
                </span>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                ) : isActive ? (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                ) : a.installed ? (
                  <span className="text-xs text-primary font-medium shrink-0">Connect</span>
                ) : (
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          New here? Install the CG Wallet extension at{" "}
          <a
            href="https://cryptogenieai.com/wallet/extension"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            cryptogenieai.com/wallet/extension
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
