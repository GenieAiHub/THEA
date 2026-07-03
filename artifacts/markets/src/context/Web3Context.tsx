import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Eip1193Provider } from "@/lib/web3/providers";
import { getWallet, resolveWalletProvider, type WalletDef } from "@/lib/web3/wallets";

const STORAGE_KEY = "thea.markets.wallet";

interface Web3ContextValue {
  walletId: string | null;
  wallet: WalletDef | null;
  account: string | null;
  chainId: string | null;
  provider: Eip1193Provider | null;
  connecting: boolean;
  isConnected: boolean;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
}

const Web3Context = createContext<Web3ContextValue | null>(null);

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [walletId, setWalletId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const disconnect = useCallback(() => {
    setWalletId(null);
    setProvider(null);
    setAccount(null);
    setChainId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const connect = useCallback(async (id: string) => {
    const def = getWallet(id);
    if (!def) throw new Error("Unknown wallet");
    const p = resolveWalletProvider(def);
    if (!p) throw new Error(`${def.name} is not installed`);

    setConnecting(true);
    try {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      const acct = accounts?.[0];
      if (!acct) throw new Error("No account was returned by the wallet");
      const cid = (await p.request({ method: "eth_chainId" })) as string;
      setProvider(p);
      setWalletId(id);
      setAccount(acct.toLowerCase());
      setChainId(String(cid).toLowerCase());
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  // Silent reconnect on load — never prompts (uses eth_accounts, not
  // eth_requestAccounts). Wallets may announce via EIP-6963 shortly after load,
  // so retry provider resolution briefly.
  useEffect(() => {
    const saved = readSaved();
    if (!saved) return;
    const def = getWallet(saved);
    if (!def) return;

    let cancelled = false;
    let tries = 0;
    const attempt = async () => {
      if (cancelled) return;
      const p = resolveWalletProvider(def);
      if (!p) {
        if (tries++ < 12) setTimeout(attempt, 300);
        return;
      }
      try {
        const accounts = (await p.request({ method: "eth_accounts" })) as string[];
        const acct = accounts?.[0];
        if (!acct || cancelled) return;
        const cid = (await p.request({ method: "eth_chainId" })) as string;
        if (cancelled) return;
        setProvider(p);
        setWalletId(saved);
        setAccount(acct.toLowerCase());
        setChainId(String(cid).toLowerCase());
      } catch {
        /* ignore — user can reconnect manually */
      }
    };
    void attempt();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track wallet account/chain changes while connected.
  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (...args: never[]) => {
      const accts = args[0] as unknown as string[];
      const acct = accts?.[0];
      if (!acct) disconnect();
      else setAccount(acct.toLowerCase());
    };
    const onChain = (...args: never[]) => {
      setChainId(String(args[0]).toLowerCase());
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, disconnect]);

  const value: Web3ContextValue = {
    walletId,
    wallet: walletId ? getWallet(walletId) ?? null : null,
    account,
    chainId,
    provider,
    connecting,
    isConnected: !!account && !!provider,
    connect,
    disconnect,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3(): Web3ContextValue {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within a Web3Provider");
  return ctx;
}
