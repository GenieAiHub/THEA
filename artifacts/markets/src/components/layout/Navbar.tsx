import { Link } from "wouter";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors border border-primary/30">
            <Activity className="w-5 h-5 text-primary logo-pulse" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-primary transition-colors">
            THEA <span className="text-primary/80 font-normal">Markets</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">
            Main Site
          </a>
        </div>
      </div>
      <div className="scanline" />
    </nav>
  );
}
