/**
 * Absolute URL to the main THEA website.
 *
 * In dev (and any single-origin deploy) the markets app is served under
 * `/markets/` and the website is at `/`, so the default `/` works. In
 * production the apps live on separate subdomains (markets.thea.quest vs
 * thea.quest), so `VITE_WEBSITE_URL` is baked in at build time — mirroring
 * how the website links back with `VITE_MARKETS_URL`.
 */
export const WEBSITE_URL: string =
  import.meta.env.VITE_WEBSITE_URL?.trim() || "/";
