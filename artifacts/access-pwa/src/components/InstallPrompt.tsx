import { useEffect, useState } from "react";
import { Download, RefreshCw, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/use-pwa";
import { applyUpdate, isIOS, promptInstall } from "@/lib/pwa";
import { storage } from "@/lib/storage";

const DISMISS_KEY = "thea.install.dismissed";

export function InstallPrompt() {
  const { canInstall, needRefresh, standalone } = usePWA();
  const [dismissed, setDismissed] = useState(
    () => storage.get(DISMISS_KEY) === "1",
  );
  const [showIOS, setShowIOS] = useState(false);

  // On iOS there is no beforeinstallprompt event — offer manual instructions
  // when the app is running in a browser tab (not already installed).
  const iosEligible = isIOS() && !standalone && !dismissed;

  useEffect(() => {
    if (iosEligible) {
      const t = setTimeout(() => setShowIOS(true), 1500);
      return () => clearTimeout(t);
    }
    setShowIOS(false);
    return undefined;
  }, [iosEligible]);

  const dismiss = () => {
    storage.set(DISMISS_KEY, "1");
    setDismissed(true);
    setShowIOS(false);
  };

  // Service-worker update banner takes priority.
  if (needRefresh) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 mx-auto max-w-lg px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-xl">
          <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Update available</p>
            <p className="text-xs text-muted-foreground">
              Reload to get the latest version.
            </p>
          </div>
          <Button size="sm" onClick={() => void applyUpdate()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }

  if (standalone || dismissed) return null;

  if (canInstall) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 mx-auto max-w-lg px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Install THEA Access</p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for offline, app-like access.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void promptInstall()}
            data-testid="button-install"
          >
            Install
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={dismiss}
            data-testid="button-install-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 mx-auto max-w-lg px-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <SquarePlus className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Install THEA Access</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tap the Share icon{" "}
                <Share className="inline h-3.5 w-3.5 align-text-bottom" /> in
                Safari, then choose{" "}
                <span className="font-medium text-foreground">
                  “Add to Home Screen”
                </span>
                .
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={dismiss}
              data-testid="button-ios-dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
