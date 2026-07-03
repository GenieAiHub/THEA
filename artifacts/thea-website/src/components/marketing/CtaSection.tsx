import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type CtaSectionProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function CtaSection({
  title = "Command the narrative",
  description = "Deploy the world's most advanced intelligence engine and turn global data into an asymmetric advantage.",
  primaryLabel = "Book a Demo",
  primaryHref = "/pricing",
  secondaryLabel = "Create Account",
  secondaryHref = "/sign-up",
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-blue-950/20 px-6 py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-background to-background" />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h2 className="mb-8 font-display text-4xl font-bold text-white drop-shadow-md md:text-5xl">
          {title}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-xl text-blue-100/70">{description}</p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="h-14 bg-blue-600 px-10 text-lg text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:bg-blue-500"
            asChild
          >
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 border-white/20 px-10 text-lg hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
