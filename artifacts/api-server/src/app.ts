import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import swaggerUi from "swagger-ui-express";
import { load as yamlLoad } from "js-yaml";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middlewares/requestId";
import { defaultRateLimiter } from "./middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import v1Router from "./routes/v1";
import healthRouter from "./routes/health";
import { handleStripeWebhook } from "./routes/webhooks/stripe";
import { handlePaypalWebhook } from "./routes/webhooks/paypal";

let openApiSpec: Record<string, unknown> = {};
try {
  const specPath = join(__dirname, "../../../lib/api-spec/openapi.yaml");
  openApiSpec = yamlLoad(readFileSync(specPath, "utf8")) as Record<string, unknown>;
} catch {
  logger.warn("OpenAPI spec not found — Swagger UI will show empty spec");
}

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

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "stripe-signature"],
    exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
  }),
);

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  handleStripeWebhook(req, res).catch((err) => {
    logger.error({ err }, "Stripe webhook handler crashed");
    res.status(500).json({ error: "Internal error" });
  });
});

// PayPal verifies via its signature API using the parsed event, so JSON is fine
// here (mounted before the global parser with a route-scoped one).
app.post("/api/webhooks/paypal", express.json({ limit: "1mb" }), (req, res) => {
  handlePaypalWebhook(req, res).catch((err) => {
    logger.error({ err }, "PayPal webhook handler crashed");
    res.status(500).json({ error: "Internal error" });
  });
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(defaultRateLimiter);

app.use("/api", healthRouter);
app.use("/api/v1", v1Router);

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "THEA API Documentation",
    swaggerOptions: { persistAuthorization: true },
  }),
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
