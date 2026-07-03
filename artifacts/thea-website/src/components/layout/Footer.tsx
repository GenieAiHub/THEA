import { Link } from "wouter";
import { MARKETS_URL } from "@/lib/urls";

const logoSrc = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`;

const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "/platform" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Technology", href: "/technology" },
      { label: "Pricing", href: "/pricing" },
      { label: "THEA Markets", href: MARKETS_URL, external: true },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Government & Political", href: "/solutions" },
      { label: "PR & Comms Agencies", href: "/solutions" },
      { label: "Brand & Reputation", href: "/solutions" },
      { label: "Newsrooms & Media", href: "/solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Knowledge Base", href: "/knowledge-base" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-background px-6 py-16 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <img
              src={logoSrc}
              alt="THEA — Total Human Engagement Analytics"
              className="mb-5 h-14 w-auto object-contain"
            />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              The all-seeing intelligence eye. THEA turns the world's conversations into real-time
              clarity — so you can see the narrative forming and act first.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-sm font-semibold text-white">{col.title}</h3>
              <ul className="space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-muted-foreground transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-muted-foreground transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-muted-foreground md:flex-row">
          <p>&copy; {new Date().getFullYear()} THEA Intelligence. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/disclaimer" className="transition-colors hover:text-white">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
