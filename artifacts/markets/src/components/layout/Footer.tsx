import { Link } from "wouter";
import { Activity } from "lucide-react";

const productLinks = [
  { label: "Markets", href: "/" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Activity", href: "/activity" },
  { label: "How it works", href: "/how-it-works" },
];

const categoryLinks = ["Politics", "Crypto", "Sports", "Tech", "Culture"];

export function Footer() {
  return (
    <footer className="border-t border-primary/20 bg-background/60 backdrop-blur-md mt-16">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <img
                src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`}
                alt="THEA"
                className="h-8 w-auto object-contain logo-pulse"
              />
              <span className="font-display font-bold text-lg tracking-tight text-white">
                Markets
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Live prediction polls powered by THEA's AI trend scanning. Trade opinions, not money.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wide mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wide mb-4">
              Categories
            </h4>
            <ul className="space-y-2.5">
              {categoryLinks.map((c) => (
                <li key={c}>
                  <Link
                    href={`/category/${encodeURIComponent(c)}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wide mb-4">
              THEA
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="/"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Main Site
                </a>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} THEA Markets. All opinions welcome.
          </p>
          <p className="text-xs text-muted-foreground/70">
            No real-money wagering. Votes reflect public sentiment only.
          </p>
        </div>
      </div>
    </footer>
  );
}
