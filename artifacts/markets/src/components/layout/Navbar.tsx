import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Menu, Search, Trophy, Zap, HelpCircle, LayoutGrid, LogOut, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

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
  const { user, isSignedIn, logout } = useAuth();

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

        <div className="hidden lg:flex items-center gap-3 shrink-0 ml-2">
          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 rounded-lg pl-3 pr-4 border border-primary/20 hover:bg-primary/10 bg-secondary/30 group gap-2">
                  <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-medium text-white truncate max-w-[120px]">
                    {user?.name || user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-primary/20">
                <DropdownMenuLabel className="font-display font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium text-foreground leading-none">{user?.name || "Operator"}</p>
                    <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/10" />
                <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary cursor-pointer" onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-white px-3 py-2 transition-colors">
                Log in
              </Link>
              <Link href="/sign-up" className="h-9 px-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                Sign up
              </Link>
            </>
          )}
        </div>

        <div className="lg:hidden ml-auto flex items-center gap-2">
          {isSignedIn && (
            <Button variant="ghost" size="icon" className="w-10 h-10 border border-primary/20 rounded-lg hover:bg-primary/10 bg-secondary/30 text-primary" onClick={() => logout()}>
              <LogOut className="w-4 h-4" />
            </Button>
          )}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-primary/20 text-white hover:bg-secondary/40 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-primary/20 w-72 flex flex-col">
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

              <div className="mt-6 flex flex-col gap-1 flex-1">
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

              {!isSignedIn && (
                <div className="mt-auto pt-6 border-t border-border/50 flex flex-col gap-2">
                  <SheetClose asChild>
                    <Link href="/sign-in" className="w-full h-10 inline-flex items-center justify-center rounded-lg border border-primary/20 bg-secondary/30 text-white text-sm font-medium hover:bg-secondary/50 transition-colors">
                      Log in
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/sign-up" className="w-full h-10 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                      Sign up
                    </Link>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="scanline" />
    </nav>
  );
}

