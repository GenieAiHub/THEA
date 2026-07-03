import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarClock,
  DoorOpen,
  Home,
  ScanFace,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="safe-top" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
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
          </Link>
          <Link
            href="/settings"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border hover-elevate active-elevate-2",
              isActive(location, "/settings") && "bg-secondary",
            )}
            data-testid="link-settings"
          >
            <SettingsGlyph />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 pb-safe-nav pt-4">{children}</main>

      <InstallPrompt />

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(location, item.path);
            const Icon = item.icon;
            if (item.primary) {
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="relative flex flex-col items-center justify-end pb-1 pt-2"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <span
                    className={cn(
                      "-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform",
                      active
                        ? "bg-primary text-primary-foreground scale-105"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.path}
                href={item.path}
                className="flex flex-col items-center gap-1 py-2.5"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="safe-bottom" />
      </nav>
    </div>
  );
}

function SettingsGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
