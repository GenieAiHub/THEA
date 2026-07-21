export const SITE_NAME = "THEA";
export const SITE_TAGLINE = "The All-Seeing Intelligence Eye";
export const SITE_DESCRIPTION =
  "THEA — Total Human Engagement Analytics. A global intelligence platform that monitors the world's conversations across 150,000+ sources to deliver real-time trend detection, sentiment analysis, and preemptive crisis alerts.";

/**
 * Absolute origin for canonical / Open Graph URLs.
 * Prefers the build-time VITE_SITE_URL (used for the static sitemap too); falls
 * back to the runtime origin so tags are always correct in any environment.
 */
export const SITE_URL: string =
  import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");

/** Build an absolute URL for a base-relative app path (BASE_URL has a trailing slash). */
export function absoluteUrl(path = "/"): string {
  const base = import.meta.env.BASE_URL; // e.g. "/" or "/site/"
  const clean = path.replace(/^\//, "");
  return `${SITE_URL}${base}${clean}`;
}

export const ogImageUrl = (): string => absoluteUrl("opengraph.jpg");

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "Total Human Engagement Analytics",
    url: absoluteUrl("/"),
    logo: absoluteUrl("logo.png"),
    slogan: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  description: string;
  path: string;
  section?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: a.title,
    description: a.description,
    url: absoluteUrl(a.path),
    articleSection: a.section,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("logo.png") },
    },
  };
}

/** Public marketing routes — kept in sync with App.tsx; used by the sitemap generator. */
export const PUBLIC_ROUTES: string[] = [
  "/",
  "/platform",
  "/attribution",
  "/how-it-works",
  "/technology",
  "/about",
  "/solutions",
  "/pricing",
  "/faq",
  "/knowledge-base",
  "/privacy",
  "/terms",
  "/disclaimer",
];
