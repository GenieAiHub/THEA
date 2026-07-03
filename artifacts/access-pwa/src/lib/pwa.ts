import { registerSW } from "virtual:pwa-register";

/**
 * Central PWA runtime state: install prompt capture, service-worker update
 * lifecycle, and standalone detection. React subscribes via usePWA().
 */

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let needRefresh = false;
let offlineReady = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribePWA(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

export interface PWAState {
  canInstall: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
  standalone: boolean;
}

export function getPWAState(): PWAState {
  return {
    canInstall: !!deferredPrompt,
    needRefresh,
    offlineReady,
    standalone: isStandalone(),
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  emit();
  await evt.prompt();
  const choice = await evt.userChoice;
  return choice.outcome === "accepted";
}

export async function applyUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW(true);
  }
}

export function dismissOfflineReady(): void {
  offlineReady = false;
  emit();
}

/**
 * Point the apple-touch-icon at an origin-absolute URL derived from BASE_URL so
 * "Add to Home Screen" works even from a nested SPA route.
 */
function fixAppleTouchIcon() {
  try {
    const href = `${window.location.origin}${import.meta.env.BASE_URL}apple-touch-icon.png`;
    let link = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "apple-touch-icon";
      document.head.appendChild(link);
    }
    link.href = href;
  } catch {
    /* non-fatal */
  }
}

export function initPWA(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  fixAppleTouchIcon();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });

  // Registers the generated service worker. In dev this is a no-op stub because
  // devOptions.enabled is false.
  updateSW = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      emit();
    },
    onOfflineReady() {
      offlineReady = true;
      emit();
    },
  });
}
