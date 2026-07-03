import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Copy, LogOut, Plus, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWeb3 } from "@/context/Web3Context";
import { useWalletBalance } from "@/hooks/use-deposit";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { DepositDialog } from "./DepositDialog";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  variant?: "desktop" | "mobile";
}

export function WalletControls({ variant = "desktop" }: Props) {
  const { isSignedIn } = useAuth();
  const { isConnected, account, wallet, disconnect } = useWeb3();
  const balanceQuery = useWalletBalance(isSignedIn);
  const [connectOpen, setConnectOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const balance = balanceQuery.data?.balance;

  const connectChip = isConnected && account ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 rounded-lg pl-2.5 pr-3 border border-primary/20 hover:bg-primary/10 bg-secondary/30 gap-2"
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: wallet?.color ?? "#7c3aed" }}
          >
            {wallet?.short ?? "W"}
          </span>
          <span className="text-sm font-medium text-white font-mono">{truncate(account)}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-primary/20">
        <DropdownMenuLabel className="font-display font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-foreground leading-none">
              {wallet?.name ?? "Wallet"}
            </p>
            <p className="text-xs text-muted-foreground leading-none font-mono">
              {truncate(account)}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-primary/10" />
        <DropdownMenuItem
          className="focus:bg-primary/10 focus:text-primary cursor-pointer"
          onClick={() => navigator.clipboard?.writeText(account)}
        >
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy address</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="focus:bg-primary/10 focus:text-primary cursor-pointer"
          onClick={() => disconnect()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button
      variant="ghost"
      onClick={() => setConnectOpen(true)}
      className="h-9 rounded-lg px-3 border border-primary/20 hover:bg-primary/10 bg-secondary/30 gap-2 text-white"
    >
      <Wallet className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium">Connect</span>
    </Button>
  );

  if (variant === "mobile") {
    return (
      <div className="flex flex-col gap-2">
        {isSignedIn && (
          <>
            <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-secondary/20 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Balance</span>
              <span className="text-sm font-semibold text-white">
                ${balance ?? "0.00"} USDT
              </span>
            </div>
            <Button onClick={() => setDepositOpen(true)} className="w-full gap-1.5">
              <Plus className="w-4 h-4" /> Deposit
            </Button>
          </>
        )}
        {isConnected && account ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-secondary/20 px-3 py-2.5">
            <span className="text-sm text-white font-mono">{truncate(account)}</span>
            <button
              onClick={() => disconnect()}
              className="text-xs text-muted-foreground hover:text-white"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConnectOpen(true)} className="w-full gap-1.5">
            <Wallet className="w-4 h-4" /> Connect wallet
          </Button>
        )}
        <ConnectWalletModal open={connectOpen} onOpenChange={setConnectOpen} />
        <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isSignedIn && (
        <>
          <div className="hidden xl:flex items-center h-9 rounded-lg border border-primary/20 bg-secondary/30 px-3">
            <span className="text-sm font-semibold text-white">${balance ?? "0.00"}</span>
            <span className="text-[11px] text-muted-foreground ml-1">USDT</span>
          </div>
          <Button onClick={() => setDepositOpen(true)} className="h-9 rounded-lg gap-1.5">
            <Plus className="w-4 h-4" /> Deposit
          </Button>
        </>
      )}
      {connectChip}
      <ConnectWalletModal open={connectOpen} onOpenChange={setConnectOpen} />
      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
    </div>
  );
}
