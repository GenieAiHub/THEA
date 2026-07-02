import React from "react";
import { Link, useLocation, Redirect } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard,
  TrendingUp,
  Eye,
  ShieldAlert,
  Cpu,
  Database,
  Settings,
  LogOut,
  ChevronRight,
  Menu
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  { icon: <Cpu className="w-4 h-4" />, label: "AI Tools", href: "/ai-tools" },
  { icon: <Database className="w-4 h-4" />, label: "Data Explorer", href: "/data-explorer" },
  { icon: <Settings className="w-4 h-4" />, label: "Settings", href: "/settings" },
];

export function DashboardLayout({ children, title }: { children: React.ReactNode, title?: string }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || "/" });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 w-full text-slate-300">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img src={`${basePath || ""}/logo.svg`} alt="THEA Logo" className="w-8 h-8" />
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
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="text-xs bg-slate-800 text-slate-400">
              {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-slate-200 truncate">
              {user?.fullName || user?.firstName || "User"}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {user?.primaryEmailAddress?.emailAddress}
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

  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
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
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </Show>
    </>
  );
}