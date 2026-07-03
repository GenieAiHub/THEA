import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

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

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      // We control registration manually (src/lib/registerSW.ts) so we can
      // surface an "update available" prompt instead of silently reloading.
      registerType: "prompt",
      injectRegister: null,
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "logo.png",
      ],
      manifest: {
        id: "./",
        name: "THEA Access",
        short_name: "THEA Access",
        description:
          "Face-based access control for your organization — scan, verify, and manage members from any device.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0a12",
        theme_color: "#0b0a12",
        categories: ["business", "productivity", "security"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the full app shell + every emitted JS/CSS chunk so the app
        // loads fully offline after the first visit (native-like behaviour).
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: `${basePath}index.html`,
        navigateFallbackDenylist: [/^\/api/, /^\/[^/]+\/api/],
        runtimeCaching: [
          {
            // Access data must never be served stale from a cache — always hit
            // the network for the API.
            urlPattern: ({ url }) => url.pathname.includes("/api/"),
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // The service worker interferes with Vite HMR + the dev API proxy, so it
      // only runs in production builds.
      devOptions: { enabled: false },
    }),
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
