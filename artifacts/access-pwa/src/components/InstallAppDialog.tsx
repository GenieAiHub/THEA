import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Download,
  Loader2,
  ScanFace,
  Share,
  ShieldCheck,
  SquarePlus,
  Star,
  WifiOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/use-pwa";
import { isIOS, promptInstall } from "@/lib/pwa";
import { haptic } from "@/lib/haptics";

const APP_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL}`
    : "https://m.thea.quest/";

const FEATURES = [
  { icon: ScanFace, label: "Face-scan check-in" },
  { icon: WifiOff, label: "Works offline" },
  { icon: ShieldCheck, label: "Secure & org-scoped" },
];

const STAGES = ["Preparing…", "Downloading…", "Installing…"];

type Phase = "idle" | "installing" | "done" | "ios" | "manual";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface InstallAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * App-store-style install popup. Runs a short "installing" simulation, then
 * either fires the real PWA install prompt (Chromium), reveals iOS
 * Add-to-Home-Screen steps, or falls back to a QR for another device.
 */
export function InstallAppDialog({ open, onOpenChange }: InstallAppDialogProps) {
  const { canInstall, standalone } = usePWA();
  const ios = isIOS();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  // Bumped whenever the dialog closes, to invalidate an in-flight simulation so
  // it can't advance (or fire the native prompt) after the user dismissed it.
  const runToken = useRef(0);

  useEffect(() => {
    if (open) {
      setPhase(standalone ? "done" : "idle");
      setProgress(0);
      setStage(0);
    } else {
      runToken.current += 1;
    }
  }, [open, standalone]);

  const runInstall = async () => {
    const token = (runToken.current += 1);
    const alive = () => token === runToken.current;

    haptic("select");
    setPhase("installing");
    // Simulated staged progress for an app-store-like feel. Kept well under the
    // ~5s transient-activation window so the real prompt() below still counts as
    // a user gesture.
    setStage(0);
    setProgress(10);
    await sleep(260);
    if (!alive()) return;
    setStage(1);
    setProgress(45);
    await sleep(300);
    if (!alive()) return;
    setStage(2);
    setProgress(80);
    await sleep(320);
    if (!alive()) return;

    if (canInstall) {
      setProgress(92);
      let accepted = false;
      try {
        accepted = await promptInstall();
      } catch {
        // prompt() can throw (already consumed / lost activation) — fall back to
        // the QR path rather than stranding the UI mid-progress.
        if (alive()) setPhase("manual");
        return;
      }
      if (!alive()) return;
      if (accepted) {
        setProgress(100);
        haptic("success");
        setPhase("done");
      } else {
        haptic("warning");
        setPhase("idle");
        setProgress(0);
      }
    } else if (ios) {
      setProgress(100);
      haptic("success");
      setPhase("ios");
    } else {
      setProgress(100);
      haptic("success");
      setPhase("manual");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-border p-0">
        {/* App identity header */}
        <div className="flex items-center gap-4 border-b border-border p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.15rem] bg-primary/15 ring-1 ring-primary/25">
            <ScanFace className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg">THEA Access</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              THEA · Access control
            </DialogDescription>
            <div className="mt-1.5 flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground">
              <span className="flex items-center gap-0.5 text-amber-400">
                <Star className="h-3 w-3 fill-current" />
                4.9
              </span>
              <span aria-hidden>·</span>
              <span>Free</span>
              <span aria-hidden>·</span>
              <span>No app store</span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "installing" ? (
              <motion.div
                key="installing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-2"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {STAGES[stage]}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </motion.div>
            ) : phase === "done" ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15"
                >
                  <Check className="h-6 w-6 text-primary" />
                </motion.div>
                <p className="text-sm font-medium">
                  {standalone ? "Already installed" : "Installed!"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  THEA Access is on your home screen.
                </p>
                <Button
                  size="lg"
                  className="mt-4 h-11 w-full"
                  onClick={() => {
                    haptic("tap");
                    window.location.href = import.meta.env.BASE_URL;
                  }}
                  data-testid="button-open-app"
                >
                  Open app
                </Button>
              </motion.div>
            ) : phase === "ios" ? (
              <motion.div
                key="ios"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-sm font-medium">One last step on iPhone</p>
                <ol className="mt-3 space-y-2.5">
                  <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Step n={1} />
                    <span>
                      Tap the Share icon{" "}
                      <Share className="inline h-4 w-4 align-text-bottom" /> in
                      Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Step n={2} />
                    <span>
                      Choose{" "}
                      <span className="font-medium text-foreground">
                        “Add to Home Screen”
                      </span>{" "}
                      <SquarePlus className="inline h-4 w-4 align-text-bottom" />.
                    </span>
                  </li>
                </ol>
              </motion.div>
            ) : phase === "manual" ? (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-sm font-medium">Open on your phone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scan with your camera, then choose “Install / Add to Home
                  Screen”.
                </p>
                <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
                  <QRCodeSVG
                    value={APP_URL}
                    size={140}
                    level="M"
                    marginSize={0}
                    data-testid="qr-install-dialog"
                  />
                </div>
                <p className="mt-3 break-all text-xs font-medium text-foreground/80">
                  {APP_URL.replace(/^https?:\/\//, "")}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ul className="mb-4 grid grid-cols-3 gap-2">
                  {FEATURES.map((f) => (
                    <li
                      key={f.label}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card/50 px-2 py-3 text-center"
                    >
                      <f.icon className="h-5 w-5 text-primary" />
                      <span className="text-[0.7rem] leading-tight text-muted-foreground">
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="h-12 w-full text-base"
                  onClick={() => void runInstall()}
                  data-testid="button-install-app"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Install app
                </Button>
                <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
                  Installs in seconds · about 2 MB
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.7rem] font-semibold text-primary">
      {n}
    </span>
  );
}
