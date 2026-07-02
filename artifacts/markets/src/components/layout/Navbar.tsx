import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Menu, Search, Trophy, Zap, HelpCircle, LayoutGrid } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Markets", href: "/", icon: LayoutGrid, exact: true },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Activity", href: "/activity", icon: Zap },
  { label: "How it works", href: "/how-it-works", icon: HelpCircle },
];

function isActive(location: string, href: string, exact?: boolean) {
  if (exact) return location === href;
  return location === href || location.startsWith(href + "/");
}

export function Navbar() {
  const [location, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = search.trim();
    navigate(term ? `/?search=${encodeURIComponent(term)}` : "/");
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4 max-w-7xl">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="relative w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors border border-primary/30">
            <Activity className="w-5 h-5 text-primary logo-pulse" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-primary transition-colors">
            THEA <span className="text-primary/80 font-normal">Markets</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1 ml-4">
          {navItems.map((item) => {
            const active = isActive(location, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-white hover:bg-secondary/40"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <form onSubmit={submitSearch} className="hidden md:block relative ml-auto w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets..."
            className="w-full pl-9 pr-3 h-9 rounded-lg bg-secondary/30 border border-primary/20 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </form>

        <a
          href="/"
          className="hidden md:inline-flex shrink-0 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
        >
          Main Site
        </a>

        <div className="lg:hidden ml-auto">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-primary/20 text-white hover:bg-secondary/40 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-primary/20 w-72">
              <SheetTitle className="font-display text-white">Menu</SheetTitle>

              <form onSubmit={submitSearch} className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search markets..."
                  className="w-full pl-9 pr-3 h-10 rounded-lg bg-secondary/30 border border-primary/20 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </form>

              <div className="mt-6 flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActive(location, item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-white hover:bg-secondary/40"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-border/50">
                <a
                  href="/"
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-secondary/40 transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  Main Site
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="scanline" />
    </nav>
  );
}
