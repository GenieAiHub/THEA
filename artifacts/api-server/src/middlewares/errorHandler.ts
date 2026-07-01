import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId: req.id,
    });
    return;
  }

  logger.error({ err, requestId: req.id, path: req.path }, "Unhandled error");

  res.status(500).json({
    error: "Internal server error",
    requestId: req.id,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    requestId: req.id,
  });
}
