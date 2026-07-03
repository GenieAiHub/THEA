import type { ReactNode } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Footer } from "@/components/layout/Footer";
import { AnimatedBackground } from "@/components/layout/AnimatedBackground";

/**
 * Shared chrome for every public marketing page. Intentionally "dumb": it owns
 * no vertical spacing so full-bleed heroes and padded content pages both work —
 * each page is responsible for its own top padding below the fixed navbar.
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-blue-500/30">
      <AnimatedBackground />
      <PublicNavbar />
      <main className="relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
