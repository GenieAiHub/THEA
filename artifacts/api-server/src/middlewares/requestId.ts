import { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.id = (req.headers["x-request-id"] as string) || randomUUID();
  next();
}
