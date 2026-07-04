import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Download,
  ScanFace,
  Share,
  ShieldCheck,
  SquarePlus,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/use-pwa";
import { isIOS, promptInstall } from "@/lib/pwa";

const APP_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL}`
    : "https://m.thea.quest/";

const FEATURES = [
  { icon: ScanFace, label: "Face-scan check-in for members" },
  { icon: WifiOff, label: "Works offline once installed" },
  { icon: ShieldCheck, label: "Secure, org-scoped access" },
];

function Feature({
  icon: Icon,
  label,
}: {
  icon: typeof ScanFace;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  );
}

export default function GetApp() {
  const { canInstall, standalone } = usePWA();
  const ios = isIOS();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="safe-top" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
            <ScanFace className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Get THEA Access
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Install the app on your phone — no app store needed.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          {standalone ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">You're all set</p>
              <p className="mt-1 text-xs text-muted-foreground">
                THEA Access is installed on this device.
              </p>
              <Button asChild size="lg" className="mt-4 h-12 w-full text-base">
                <a href={import.meta.env.BASE_URL} data-testid="link-open-app">
                  Open the app
                </a>
              </Button>
            </div>
          ) : canInstall ? (
            <div className="text-center">
              <p className="text-sm font-medium">Ready to install</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add THEA Access to your home screen for an app-like,
                offline-ready experience.
              </p>
              <Button
                size="lg"
                className="mt-4 h-12 w-full text-base"
                onClick={() => void promptInstall()}
                data-testid="button-install-app"
              >
                <Download className="mr-2 h-5 w-5" />
                Install app
              </Button>
            </div>
          ) : ios ? (
            <div>
              <p className="text-center text-sm font-medium">
                Install on iPhone or iPad
              </p>
              <ol className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    1
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Open this page in{" "}
                    <span className="font-medium text-foreground">Safari</span>.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    2
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Tap the Share icon{" "}
                    <Share className="inline h-4 w-4 align-text-bottom" />.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    3
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Choose{" "}
                    <span className="font-medium text-foreground">
                      "Add to Home Screen"
                    </span>{" "}
                    <SquarePlus className="inline h-4 w-4 align-text-bottom" />.
                  </p>
                </li>
              </ol>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium">Open on your phone to install</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scan the code below with your phone's camera, then use your
                browser's{" "}
                <span className="font-medium text-foreground">
                  Install / Add to Home Screen
                </span>{" "}
                option.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center border-t border-border pt-6">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG
                value={APP_URL}
                size={148}
                level="M"
                marginSize={0}
                data-testid="qr-install"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Scan to open on another device
            </p>
            <p className="mt-1 break-all text-center text-xs font-medium text-foreground/80">
              {APP_URL.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((f) => (
            <Feature key={f.label} icon={f.icon} label={f.label} />
          ))}
        </ul>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}
