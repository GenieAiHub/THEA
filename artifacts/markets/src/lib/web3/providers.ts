// EIP-6963 multi-injected-provider discovery, with a window.ethereum fallback.
// This lets us present the specific wallets the user picks (MetaMask, Coinbase,
// Trust, SafePal, Brave, CG Wallet) rather than a single ambiguous provider.

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

export interface ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DiscoveredProvider {
  info: ProviderInfo;
  provider: Eip1193Provider;
}

type Listener = (providers: DiscoveredProvider[]) => void;

const discovered = new Map<string, DiscoveredProvider>();
const listeners = new Set<Listener>();
let started = false;

function emit() {
  const list = Array.from(discovered.values());
  for (const l of listeners) l(list);
}

function requestAnnouncements() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<DiscoveredProvider>).detail;
    if (!detail?.info?.rdns || !detail.provider) return;
    discovered.set(detail.info.rdns, detail);
    emit();
  });
  requestAnnouncements();
}

/** Snapshot of currently-announced EIP-6963 providers (also re-requests). */
export function getDiscoveredProviders(): DiscoveredProvider[] {
  start();
  requestAnnouncements();
  return Array.from(discovered.values());
}

export function subscribeProviders(listener: Listener): () => void {
  start();
  listeners.add(listener);
  listener(Array.from(discovered.values()));
  requestAnnouncements();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Legacy injected providers on window.ethereum. Can be a single provider or a
 * list when several wallets coexist (some inject `ethereum.providers`).
 */
export function getInjectedProviders(): Eip1193Provider[] {
  if (typeof window === "undefined") return [];
  const eth = (window as unknown as { ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] } })
    .ethereum;
  if (!eth) return [];
  if (Array.isArray(eth.providers) && eth.providers.length) return eth.providers;
  return [eth];
}
