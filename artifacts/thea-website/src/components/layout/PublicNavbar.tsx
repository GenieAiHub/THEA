import { Link } from "wouter";
import { MARKETS_URL } from "@/lib/urls";

export function PublicNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md border-b border-white/5 bg-background/50">
      <Link href="/">
        <img
          src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`}
          alt="THEA"
          className="h-9 w-auto object-contain"
        />
      </Link>
      <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
        <a href="/#capabilities" className="hover:text-white transition-colors">Capabilities</a>
        <a href="/#how-it-works" className="hover:text-white transition-colors">How it Works</a>
        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        <a
          href={MARKETS_URL}
          className="relative flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-semibold"
          data-testid="link-markets-nav"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          THEA Markets
        </a>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">
          Log in
        </Link>
        <Link href="/sign-up" className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50">
          Sign up
        </Link>
      </div>
    </nav>
  );
}
