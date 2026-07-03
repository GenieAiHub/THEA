import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { writeFile, readFile } from "node:fs/promises";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Absolute production origin, used for the build-time sitemap, robots.txt Sitemap
// directive, and the absolute og:image/og:url baked into index.html. Defaults to the
// primary THEA domain; override with VITE_SITE_URL (wired via WEBSITE_SITE_URL in
// docker-compose.yml). At runtime the Seo component recomputes these from the browser
// origin, so this only affects non-JS crawlers/scrapers.
const SITE_URL = (process.env.VITE_SITE_URL || "https://thea.quest").replace(
  /\/$/,
  "",
);
const SITE_BASE = basePath.endsWith("/") ? basePath : `${basePath}/`;
const absoluteSiteUrl = (route: string) =>
  `${SITE_URL}${SITE_BASE}${route.replace(/^\//, "")}`;

// Routes that should appear in sitemap.xml. Kept in sync with PUBLIC_ROUTES in
// src/lib/seo.ts. Knowledge-base article routes are appended at build time.
const SITEMAP_STATIC_ROUTES = [
  "/",
  "/platform",
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

function seoBuildPlugin(): Plugin {
  return {
    name: "thea-seo-build",
    apply: "build",
    // Bake absolute og:image/twitter:image/og:url into the HTML shell so non-JS
    // social scrapers (Facebook, Twitter, LinkedIn, Slack) get valid absolute URLs.
    transformIndexHtml(html) {
      const ogImage = absoluteSiteUrl("/opengraph.jpg");
      let out = html.replaceAll('content="/opengraph.jpg"', `content="${ogImage}"`);
      if (!/property="og:url"/.test(out)) {
        out = out.replace(
          '<meta property="og:image"',
          `<meta property="og:url" content="${absoluteSiteUrl("/")}" />\n    <meta property="og:image"`,
        );
      }
      return out;
    },
    async closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist/public");

      const routes = [...SITEMAP_STATIC_ROUTES];
      try {
        const mod = await import("./src/content/knowledge-base");
        for (const article of mod.KB_ARTICLES) {
          routes.push(`/knowledge-base/${article.slug}`);
        }
      } catch {
        // Article routes are best-effort; static routes are always emitted.
      }

      const lastmod = new Date().toISOString().slice(0, 10);
      const urls = routes
        .map(
          (route) =>
            `  <url>\n    <loc>${absoluteSiteUrl(route)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
        )
        .join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
      await writeFile(path.join(outDir, "sitemap.xml"), xml, "utf8");

      const robotsPath = path.join(outDir, "robots.txt");
      let robots = "User-agent: *\nAllow: /\n";
      try {
        robots = await readFile(robotsPath, "utf8");
      } catch {
        // Fall back to a sensible default if robots.txt was not copied.
      }
      robots = robots
        .split("\n")
        .filter((line) => !/^\s*Sitemap:/i.test(line))
        .join("\n")
        .trimEnd();
      robots += `\nSitemap: ${absoluteSiteUrl("/sitemap.xml")}\n`;
      await writeFile(robotsPath, robots, "utf8");
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    seoBuildPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
