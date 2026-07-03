import { useEffect } from "react";
import { absoluteUrl, ogImageUrl, SITE_NAME } from "@/lib/seo";

type SeoProps = {
  title: string;
  description: string;
  /** Base-relative path for this page, e.g. "/platform". */
  path: string;
  ogType?: "website" | "article";
  ogImage?: string;
  noindex?: boolean;
  /** One or more JSON-LD objects to inject for structured data. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Per-route SEO for the THEA SPA. Imperatively upserts the document title, meta,
 * canonical, Open Graph / Twitter tags and JSON-LD so there is exactly one of
 * each (no duplication with the static brand defaults in index.html). Static
 * index.html tags remain the fallback for social scrapers that do not run JS.
 */
export function Seo({
  title,
  description,
  path,
  ogType = "website",
  ogImage,
  noindex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonical = absoluteUrl(path);
  const image = ogImage ?? ogImageUrl();

  useEffect(() => {
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow",
    );
    upsertLink("canonical", canonical);

    upsertMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:type"]', "property", "og:type", ogType);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME);

    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    document.head.querySelectorAll("script[data-seo-jsonld]").forEach((n) => n.remove());
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const block of blocks) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "");
        script.textContent = JSON.stringify(block);
        document.head.appendChild(script);
      }
    }

    return () => {
      document.head.querySelectorAll("script[data-seo-jsonld]").forEach((n) => n.remove());
    };
  }, [fullTitle, description, canonical, image, ogType, noindex, jsonLd]);

  return null;
}
