import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middlewares/requestId";
import { defaultRateLimiter } from "./middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import v1Router from "./routes/v1";
import healthRouter from "./routes/health";
import { handleStripeWebhook } from "./routes/webhooks/stripe";
import { handleClerkWebhook } from "./routes/webhooks/clerk";

const app: Express = express();

app.set("trust proxy", 1);

app.use(requestIdMiddleware);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "svix-id", "svix-timestamp", "svix-signature", "stripe-signature"],
    exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
  }),
);

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  handleStripeWebhook(req, res).catch((err) => {
    logger.error({ err }, "Stripe webhook handler crashed");
    res.status(500).json({ error: "Internal error" });
  });
});

app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), (req, res) => {
  handleClerkWebhook(req, res).catch((err) => {
    logger.error({ err }, "Clerk webhook handler crashed");
    res.status(500).json({ error: "Internal error" });
  });
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(defaultRateLimiter);

app.use("/api", healthRouter);
app.use("/api/v1", v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
