import { useState } from "react";
import {
  Bell,
  BellRing,
  Building2,
  Download,
  Fingerprint,
  LogOut,
  MapPin,
  Share2,
  ShieldCheck,
  Smartphone,
  Vibrate,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { usePWA } from "@/hooks/use-pwa";
import { useNotifications } from "@/hooks/use-notifications";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { promptInstall } from "@/lib/pwa";
import { biometricLabel } from "@/lib/biometric";
import {
  getCurrentLocation,
  GeoError,
  formatCoords,
} from "@/lib/geolocation";
import { haptic, isHapticsSupported } from "@/lib/haptics";
import { notify } from "@/lib/notifications";
import { share, isShareSupported } from "@/lib/share";
import { isWakeLockSupported } from "@/lib/wake-lock";
import { NativeHeader } from "@/components/native/NativeHeader";
import { Pressable } from "@/components/native/Pressable";
import { toast } from "sonner";

export default function Settings() {
  const {
    user,
    org,
    tier,
    logout,
    biometricEnabled,
    biometricAvailable,
    enableBiometric,
    disableBiometric,
  } = useAuth();
  const { canInstall, standalone, offlineReady } = usePWA();
  const notifications = useNotifications();
  const online = useNetworkStatus();
  const [bioBusy, setBioBusy] = useState(false);

  const onToggleBiometric = async (next: boolean) => {
    if (!next) {
      disableBiometric();
      toast.success("Biometric unlock disabled");
      return;
    }
    setBioBusy(true);
    try {
      const ok = await enableBiometric();
      toast[ok ? "success" : "error"](
        ok
          ? "Biometric unlock enabled"
          : "Couldn't set up biometrics. Please try again.",
      );
    } finally {
      setBioBusy(false);
    }
  };

  const enableNotifications = async () => {
    const next = await notifications.request();
    if (next === "granted") {
      await notify({
        title: "Notifications on",
        body: "You'll get alerts for access events.",
        tag: "notif-test",
      });
      toast.success("Notifications enabled");
    } else if (next === "denied") {
      toast.error("Notifications blocked in your browser settings");
    } else if (next === "unsupported") {
      toast.error("Notifications aren't supported here");
    }
  };

  const testHaptics = () => {
    haptic("success");
    toast.success(
      isHapticsSupported()
        ? "Buzz! Feel that?"
        : "No vibration support on this device",
    );
  };

  const testLocation = async () => {
    try {
      const c = await getCurrentLocation();
      haptic("success");
      toast.success(`Location OK — ${formatCoords(c)}`);
    } catch (err) {
      haptic("error");
      toast.error(
        err instanceof GeoError ? err.message : "Couldn't get location.",
      );
    }
  };

  const shareApp = async () => {
    const res = await share({
      title: "THEA Access",
      text: "Manage secure access with THEA Access",
      url: window.location.origin + import.meta.env.BASE_URL,
    });
    if (res === "copied") toast.success("Link copied to clipboard");
    else if (res === "unavailable") toast.error("Sharing isn't available");
  };

  return (
    <div className="space-y-6">
      <NativeHeader title="Settings" />

      {/* Account */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-sm font-semibold text-primary">
            {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user?.name ?? user?.email}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {user?.role}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <Row
            icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
            label="Organization"
            value={org?.name ?? "—"}
          />
          {tier && (
            <Row
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              label="Plan"
              value={<span className="capitalize">{tier}</span>}
            />
          )}
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-border bg-card">
        <SectionTitle>Security</SectionTitle>
        <div className="flex items-center gap-3 p-4">
          <IconTile>
            <Fingerprint className="h-5 w-5 text-primary" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Biometric unlock</p>
            <p className="text-xs text-muted-foreground">
              {biometricAvailable
                ? `Require ${biometricLabel()} to open the app`
                : "Not available on this device"}
            </p>
          </div>
          <Switch
            checked={biometricEnabled}
            disabled={!biometricAvailable || bioBusy}
            onCheckedChange={onToggleBiometric}
            data-testid="switch-biometric"
          />
        </div>
      </section>

      {/* Device & permissions */}
      <section className="rounded-2xl border border-border bg-card">
        <SectionTitle>Device &amp; permissions</SectionTitle>
        <div className="divide-y divide-border">
          <div className="flex items-center gap-3 p-4">
            <IconTile>
              {notifications.permission === "granted" ? (
                <BellRing className="h-5 w-5 text-success" />
              ) : (
                <Bell className="h-5 w-5 text-accent-foreground" />
              )}
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {!notifications.supported
                  ? "Not supported on this device"
                  : notifications.permission === "granted"
                    ? "On — you'll get access alerts"
                    : notifications.permission === "denied"
                      ? "Blocked in browser settings"
                      : "Get alerted on denied entries"}
              </p>
            </div>
            {notifications.supported &&
              notifications.permission !== "granted" &&
              notifications.permission !== "denied" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={enableNotifications}
                  data-testid="button-enable-notifications"
                >
                  Enable
                </Button>
              )}
            {notifications.permission === "granted" && (
              <ShieldCheck className="h-5 w-5 text-success" />
            )}
          </div>

          <div className="flex items-center gap-3 p-4">
            <IconTile>
              <Vibrate className="h-5 w-5 text-accent-foreground" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Haptics</p>
              <p className="text-xs text-muted-foreground">
                {isHapticsSupported()
                  ? "Tactile feedback on actions"
                  : "No vibration on this device"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={testHaptics}
              data-testid="button-test-haptics"
            >
              Test
            </Button>
          </div>

          <div className="flex items-center gap-3 p-4">
            <IconTile>
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Location</p>
              <p className="text-xs text-muted-foreground">
                Test location permission
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={testLocation}
              data-testid="button-test-location"
            >
              Test
            </Button>
          </div>

          <div className="flex items-center gap-3 p-4">
            <IconTile>
              {online ? (
                <Wifi className="h-5 w-5 text-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-warning" />
              )}
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Connection</p>
              <p className="text-xs text-muted-foreground">
                {online ? "Online" : "Offline — changes may not save"}
                {isWakeLockSupported() ? " · screen stays awake on scan" : ""}
              </p>
            </div>
            <span
              className={
                online
                  ? "h-2.5 w-2.5 rounded-full bg-success"
                  : "h-2.5 w-2.5 rounded-full bg-warning"
              }
            />
          </div>
        </div>
      </section>

      {/* App */}
      <section className="rounded-2xl border border-border bg-card">
        <SectionTitle>App</SectionTitle>
        <div className="divide-y divide-border">
          <div className="flex items-center gap-3 p-4">
            <IconTile>
              <Smartphone className="h-5 w-5 text-accent-foreground" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Install app</p>
              <p className="text-xs text-muted-foreground">
                {standalone
                  ? "Installed — running as an app"
                  : "Add to your home screen"}
              </p>
            </div>
            {!standalone && canInstall && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void promptInstall()}
                data-testid="button-settings-install"
              >
                <Download className="mr-2 h-4 w-4" /> Install
              </Button>
            )}
            {standalone && <ShieldCheck className="h-5 w-5 text-success" />}
          </div>

          <div className="flex items-center gap-3 p-4">
            <IconTile>
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Offline ready</p>
              <p className="text-xs text-muted-foreground">
                {offlineReady || standalone
                  ? "App is cached for offline use"
                  : "Caches after your first visit"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4">
            <IconTile>
              <Share2 className="h-5 w-5 text-accent-foreground" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Share app</p>
              <p className="text-xs text-muted-foreground">
                {isShareSupported()
                  ? "Send THEA Access to a teammate"
                  : "Copy the app link"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={shareApp}
              data-testid="button-share-app"
            >
              Share
            </Button>
          </div>
        </div>
      </section>

      <Pressable
        hapticPattern="warning"
        className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-destructive hover-elevate active-elevate-2"
        onClick={() => void logout()}
        data-testid="button-signout"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Pressable>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        THEA Access · Secure entry control
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
