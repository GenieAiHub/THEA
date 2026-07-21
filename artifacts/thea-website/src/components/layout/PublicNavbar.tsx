import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Menu } from "lucide-react";
import { MARKETS_URL } from "@/lib/urls";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const logoSrc = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`;

const productLinks = [
  { href: "/platform", label: "Platform", desc: "The full intelligence suite" },
  { href: "/attribution", label: "Attribution", desc: "Mobile measurement & growth analytics" },
  { href: "/how-it-works", label: "How It Works", desc: "The five-stage pipeline" },
  { href: "/technology", label: "Technology", desc: "Inside the engine" },
  { href: "/solutions", label: "Solutions", desc: "By team & use case" },
];

const resourceLinks = [
  { href: "/faq", label: "FAQ", desc: "Common questions" },
  { href: "/knowledge-base", label: "Knowledge Base", desc: "Guides & documentation" },
];

function DesktopDropdown({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; desc: string }[];
}) {
  return (
    <div className="group relative">
      <button className="flex items-center gap-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-white">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </button>
      <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-64 rounded-xl border border-white/10 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
            >
              <div className="text-sm font-medium text-white">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/5 bg-background/50 px-6 py-5 backdrop-blur-md md:px-8">
      <Link href="/">
        <img src={logoSrc} alt="THEA" className="h-14 w-auto object-contain" />
      </Link>

      {/* Desktop nav */}
      <div className="hidden items-center gap-7 md:flex">
        <DesktopDropdown label="Product" items={productLinks} />
        <DesktopDropdown label="Resources" items={resourceLinks} />
        <Link
          href="/about"
          className="py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-white"
        >
          About
        </Link>
        <Link
          href="/pricing"
          className="py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-white"
        >
          Pricing
        </Link>
        <a
          href={MARKETS_URL}
          className="relative flex items-center gap-1.5 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300"
          data-testid="link-markets-nav"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          THEA Markets
        </a>
      </div>

      {/* Desktop auth */}
      <div className="hidden items-center gap-4 md:flex">
        <Link
          href="/sign-in"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-white"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        >
          Sign up
        </Link>
      </div>

      {/* Mobile trigger */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-white"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-full border-white/10 bg-background/95 backdrop-blur-xl sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="text-left text-white">Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-6 overflow-y-auto pb-10">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product
                </p>
                <div className="flex flex-col">
                  {productLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="py-2 text-base text-white/90 hover:text-blue-400"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resources
                </p>
                <div className="flex flex-col">
                  {resourceLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="py-2 text-base text-white/90 hover:text-blue-400"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href="/about"
                    onClick={() => setOpen(false)}
                    className="py-2 text-base text-white/90 hover:text-blue-400"
                  >
                    About
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setOpen(false)}
                    className="py-2 text-base text-white/90 hover:text-blue-400"
                  >
                    Pricing
                  </Link>
                </div>
              </div>
              <a
                href={MARKETS_URL}
                className="flex items-center gap-2 py-2 text-base font-semibold text-blue-400"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                THEA Markets
              </a>
              <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-6">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/10 text-sm font-medium text-white hover:bg-white/5"
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
