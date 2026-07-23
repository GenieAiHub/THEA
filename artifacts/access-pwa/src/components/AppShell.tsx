import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarClock,
  DoorOpen,
  Home,
  ScanFace,
  Settings as SettingsIcon,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PressableLink } from "@/components/native/Pressable";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { spring } from "@/components/native/motion";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/members", label: "Members", icon: Users },
  { path: "/scan", label: "Scan", icon: ScanFace, primary: true },
  { path: "/access-points", label: "Access", icon: DoorOpen },
  { path: "/events", label: "Events", icon: CalendarClock },
];

function isActive(current: string, path: string): boolean {
  if (path === "/") return current === "/";
  return current === path || current.startsWith(`${path}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { org } = useAuth();
  const online = useNetworkStatus();
  const settingsActive = isActive(location, "/settings");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="safe-top" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <PressableLink
            href="/"
            hapticPattern="tap"
            className="flex min-w-0 items-center gap-2.5"
            data-testid="link-home-brand"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
              <ScanFace className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {org?.name ?? "THEA Access"}
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Access control
              </p>
            </div>
          </PressableLink>
          <div className="flex items-center gap-2">
          <PressableLink
            href="/alerts"
            hapticPattern="tap"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover-elevate active-elevate-2",
              isActive(location, "/alerts") && "bg-secondary text-foreground",
            )}
            data-testid="link-alerts"
          >
            <Bell className="h-[18px] w-[18px]" />
          </PressableLink>
          <PressableLink
            href="/settings"
            hapticPattern="tap"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover-elevate active-elevate-2",
              settingsActive && "bg-secondary text-foreground",
            )}
            data-testid="link-settings"
          >
            <SettingsIcon className="h-[18px] w-[18px]" />
          </PressableLink>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {!online && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-warning/15"
            >
              <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium text-warning">
                <WifiOff className="h-3.5 w-3.5" />
                Offline — showing your last synced data
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative flex-1 px-4 pb-safe-nav pt-4">{children}</main>

      <InstallPrompt />

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(location, item.path);
            const Icon = item.icon;

            if (item.primary) {
              return (
                <PressableLink
                  key={item.path}
                  href={item.path}
                  hapticPattern="select"
                  className="relative flex flex-col items-center justify-end pb-1 pt-2"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <motion.span
                    animate={{ scale: active ? 1.06 : 1 }}
                    transition={spring}
                    className={cn(
                      "-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                      active && "ring-4 ring-primary/25",
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </motion.span>
                  <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.label}
                  </span>
                </PressableLink>
              );
            }

            return (
              <PressableLink
                key={item.path}
                href={item.path}
                hapticPattern="select"
                className="relative flex flex-col items-center gap-1 py-2.5"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={spring}
                    className="absolute inset-x-3 top-1 h-8 rounded-full bg-primary/12"
                  />
                )}
                <Icon
                  className={cn(
                    "relative h-5 w-5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "relative text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </PressableLink>
            );
          })}
        </div>
        <div className="safe-bottom" />
      </nav>
    </div>
  );
}
