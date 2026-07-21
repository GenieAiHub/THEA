import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  // Live HLS playback fetches a playlist + segment every ~2s (≈900 req/15min),
  // so stream paths must bypass the default budget or one viewer exhausts it.
  skip: (req) =>
    req.path === "/api/v1/health" ||
    (req.path.startsWith("/api/v1/watch/cameras/") && req.path.includes("/stream/")),
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

export const apiKeyRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers["authorization"] as string) || ipKeyGenerator(req.ip ?? ""),
  message: { error: "API key daily rate limit exceeded." },
});
