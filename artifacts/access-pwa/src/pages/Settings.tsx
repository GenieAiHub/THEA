import { useState } from "react";
import {
  Building2,
  Download,
  Fingerprint,
  LogOut,
  MapPin,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { usePWA } from "@/hooks/use-pwa";
import { promptInstall } from "@/lib/pwa";
import { biometricLabel } from "@/lib/biometric";
import {
  getCurrentLocation,
  GeoError,
  formatCoords,
} from "@/lib/geolocation";
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

  const testLocation = async () => {
    try {
      const c = await getCurrentLocation();
      toast.success(`Location OK — ${formatCoords(c)}`);
    } catch (err) {
      toast.error(
        err instanceof GeoError ? err.message : "Couldn't get location.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Fingerprint className="h-5 w-5 text-primary" />
          </div>
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

      {/* App */}
      <section className="rounded-2xl border border-border bg-card">
        <SectionTitle>App</SectionTitle>
        <div className="divide-y divide-border">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Smartphone className="h-5 w-5 text-accent-foreground" />
            </div>
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
            {standalone && (
              <ShieldCheck className="h-5 w-5 text-success" />
            )}
          </div>

          <div className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </div>
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
        </div>
      </section>

      <Button
        variant="outline"
        className="w-full text-destructive"
        onClick={() => void logout()}
        data-testid="button-signout"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>

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
