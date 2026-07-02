import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, KeyRound, Terminal, BarChart2, Building2, LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/api-keys", label: "API Keys", icon: KeyRound },
    { href: "/llm-test", label: "LLM Playground", icon: Terminal },
    { href: "/usage", label: "Usage Logs", icon: BarChart2 },
    { href: "/orgs", label: "Organizations", icon: Building2 },
  ];

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="w-64 border-r border-border bg-sidebar flex flex-col justify-between hidden md:flex">
        <div>
          <div className="h-14 flex items-center px-6 border-b border-border">
            <span className="font-mono font-bold tracking-tight text-primary">
              THEA<span className="text-muted-foreground">_OP</span>
            </span>
          </div>
          <nav className="p-4 space-y-1">
            {nav.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-mono transition-all rounded-sm ${
                    active
                      ? "bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent pl-[10px]"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 text-sm font-mono text-muted-foreground hover:text-destructive w-full transition-colors rounded-sm"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-6">
          <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
            Super Admin Console
          </span>
          <span className="text-xs font-mono text-primary/60">
            {new Date().toUTCString().replace(" GMT", " UTC")}
          </span>
        </div>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
