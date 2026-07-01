import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middlewares/requestId";
import { defaultRateLimiter } from "./middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import v1Router from "./routes/v1";
import healthRouter from "./routes/health";

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
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(defaultRateLimiter);

app.use("/api", healthRouter);
app.use("/api/v1", v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
