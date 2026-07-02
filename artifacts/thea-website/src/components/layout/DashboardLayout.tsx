import React, { useEffect, useRef } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  TrendingUp,
  Eye,
  ShieldAlert,
  Brain,
  Database,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  Target,
  Sword,
  Bell,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useListAlerts } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const navItems: SidebarItem[] = [
  { icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard", href: "/dashboard" },
  { icon: <TrendingUp className="w-4 h-4" />, label: "Trends", href: "/trends" },
  { icon: <Eye className="w-4 h-4" />, label: "Watchlist", href: "/watchlist" },
  { icon: <ShieldAlert className="w-4 h-4" />, label: "Alerts", href: "/alerts" },
  { icon: <Brain className="w-4 h-4" />, label: "Intelligence", href: "/intelligence" },
  { icon: <Database className="w-4 h-4" />, label: "Data Explorer", href: "/data-explorer" },
  { icon: <Target className="w-4 h-4" />, label: "Campaigns", href: "/campaigns" },
  { icon: <Sword className="w-4 h-4" />, label: "Competitors", href: "/competitors" },
  { icon: <Settings className="w-4 h-4" />, label: "Settings", href: "/settings" },
];

function GlobalAlertWatcher() {
  const { toast } = useToast();
  const seenIds = useRef<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const basePath = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";
    const streamUrl = `${basePath}/api/v1/alerts/stream`;

    const connect = () => {
      if (esRef.current) {
        esRef.current.close();
      }
      const es = new EventSource(streamUrl, { withCredentials: true });
      esRef.current = es;

      es.addEventListener("alert", (e: MessageEvent) => {
        try {
          const alert = JSON.parse(e.data);
          if (seenIds.current.has(alert.id)) return;
          seenIds.current.add(alert.id);
          if (alert.severity === "critical" || alert.severity === "high") {
            toast({
              title: `⚠ ${alert.severity === "critical" ? "Critical" : "High"} Alert`,
              description: alert.title || "New alert triggered",
              variant: "destructive",
            });
          }
        } catch {
          // malformed event — ignore
        }
      });

      es.addEventListener("error", () => {
        es.close();
        esRef.current = null;
        // Reconnect after 30s if connection dropped
        setTimeout(connect, 30_000);
      });
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [toast]);

  return null;
}

function NotificationBell() {
  const { data: alertsData } = useListAlerts<any>({ status: "open", limit: 50 });
  const openCount = (alertsData?.data || []).length;
  return (
    <Link href="/alerts">
      <div className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors">
        <Bell className="w-4 h-4 text-slate-400" />
        {openCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {openCount > 99 ? "99+" : openCount}
          </span>
        )}
      </div>
    </Link>
  );
}

export function DashboardLayout({ children, title }: { children: React.ReactNode, title?: string }) {
  const { user, org, logout, isLoaded, isSignedIn } = useAuth();
  const [location, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const displayName = user?.name || user?.email || "User";
  const initials = (user?.name?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase();

  const handleSignOut = async () => {
    await logout();
    setLocation("/");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 w-full text-slate-300">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img src={`${basePath || ""}/logo.png`} alt="THEA Logo" className="w-8 h-8" />
          <span className="font-display font-bold text-xl tracking-tight text-white">THEA</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400 font-medium"
                    : "hover:bg-slate-900 hover:text-slate-100"
                }`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="w-9 h-9 border border-slate-700 bg-slate-800">
            <AvatarFallback className="text-xs bg-slate-800 text-slate-400">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-slate-200 truncate">
              {displayName}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {user?.email}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  if (!isLoaded) {
    return <div className="h-[100dvh] bg-[#020617]" />;
  }
  if (!isSignedIn) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-[100dvh] bg-[#020617] text-slate-200 font-sans overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-10">
            <SidebarContent />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col md:pl-64 min-w-0">
            {/* Topbar */}
            <header className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden text-slate-400">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72 bg-slate-950 border-r-slate-800">
                    <SidebarContent />
                  </SheetContent>
                </Sheet>
                
                {title && (
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-slate-500 hidden sm:inline-block">Portal</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:inline-block" />
                    <span className="text-slate-200">{title}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">
                    {org?.name || "My Org"}
                  </span>
                </div>
                <NotificationBell />
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <GlobalAlertWatcher />
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
  );
}