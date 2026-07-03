import {
  getDiscoveredProviders,
  getInjectedProviders,
  type DiscoveredProvider,
  type Eip1193Provider,
} from "./providers";

export interface WalletDef {
  id: string;
  name: string;
  /** EIP-6963 rdns identifiers this wallet may announce. */
  rdns: string[];
  /** Substrings matched against an announced provider name (fallback). */
  nameMatch: string[];
  /** Legacy injected flags on the provider object (last-resort fallback). */
  flags: string[];
  /** Brand color for the fallback avatar. */
  color: string;
  /** Short label for the fallback avatar. */
  short: string;
  /** Where to install the wallet if it isn't detected. */
  downloadUrl: string;
}

// CG Wallet's rdns / injected flag is not publicly documented, so it is matched
// resiliently by several candidate rdns values, a name substring, and common
// injected-flag guesses; if none match, the picker shows an install link.
export const WALLETS: WalletDef[] = [
  {
    id: "cg",
    name: "CG Wallet",
    rdns: ["ai.cryptogenie", "com.cryptogenie", "ai.cryptogenieai", "com.cryptogenieai", "io.cryptogenie"],
    nameMatch: ["crypto genie", "cryptogenie", "cg wallet", "genie"],
    flags: ["isCryptoGenie", "isCryptoGenieWallet", "isCGWallet", "isGenie"],
    color: "#7c3aed",
    short: "CG",
    downloadUrl: "https://cryptogenieai.com/wallet/extension",
  },
  {
    id: "metamask",
    name: "MetaMask",
    rdns: ["io.metamask", "io.metamask.mobile"],
    nameMatch: ["metamask"],
    flags: ["isMetaMask"],
    color: "#f6851b",
    short: "MM",
    downloadUrl: "https://metamask.io/download/",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    rdns: ["com.trustwallet.app"],
    nameMatch: ["trust wallet", "trust"],
    flags: ["isTrust", "isTrustWallet"],
    color: "#3375bb",
    short: "TW",
    downloadUrl: "https://trustwallet.com/download",
  },
  {
    id: "safepal",
    name: "SafePal",
    rdns: ["io.safepal", "com.safepal", "global.safepal"],
    nameMatch: ["safepal"],
    flags: ["isSafePal", "isSafePalWallet"],
    color: "#4a6bf5",
    short: "SP",
    downloadUrl: "https://www.safepal.com/en/download",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    rdns: ["com.coinbase.wallet"],
    nameMatch: ["coinbase"],
    flags: ["isCoinbaseWallet"],
    color: "#0052ff",
    short: "CB",
    downloadUrl: "https://www.coinbase.com/wallet/downloads",
  },
  {
    id: "brave",
    name: "Brave Wallet",
    rdns: ["com.brave.wallet"],
    nameMatch: ["brave"],
    flags: ["isBraveWallet"],
    color: "#fb542b",
    short: "BR",
    downloadUrl: "https://brave.com/wallet/",
  },
];

export function getWallet(id: string): WalletDef | undefined {
  return WALLETS.find((w) => w.id === id);
}

export interface WalletAvailability {
  def: WalletDef;
  installed: boolean;
  /** The announced provider (icon/name) when discovered via EIP-6963. */
  discovered?: DiscoveredProvider;
}

function matchDiscovered(
  def: WalletDef,
  list: DiscoveredProvider[],
): DiscoveredProvider | undefined {
  const byRdns = list.find((d) => def.rdns.includes(d.info.rdns));
  if (byRdns) return byRdns;
  return list.find((d) =>
    def.nameMatch.some((n) => d.info.name.toLowerCase().includes(n)),
  );
}

function matchInjected(def: WalletDef): Eip1193Provider | undefined {
  const list = getInjectedProviders();
  return list.find((p) =>
    def.flags.some((f) => (p as unknown as Record<string, unknown>)[f] === true),
  );
}

/** Availability for every known wallet, using EIP-6963 first, then injected flags. */
export function getWalletAvailability(): WalletAvailability[] {
  const discoveredList = getDiscoveredProviders();
  return WALLETS.map((def) => {
    const discovered = matchDiscovered(def, discoveredList);
    const installed = !!discovered || !!matchInjected(def);
    return { def, installed, discovered };
  });
}

/**
 * Resolve a connectable EIP-1193 provider for a wallet, or null if it can't be
 * found. Prefers the EIP-6963-announced provider, then a matching injected one.
 */
export function resolveWalletProvider(def: WalletDef): Eip1193Provider | null {
  const discovered = matchDiscovered(def, getDiscoveredProviders());
  if (discovered) return discovered.provider;
  return matchInjected(def) ?? null;
}
