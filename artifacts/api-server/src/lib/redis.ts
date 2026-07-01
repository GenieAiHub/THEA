import { Redis } from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL;

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    if (!REDIS_URL) {
      throw new Error("REDIS_URL environment variable is required");
    }
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        logger.warn({ err }, "Redis reconnect on error");
        return true;
      },
    });

    redisClient.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected");
    });

    redisClient.on("reconnecting", () => {
      logger.warn("Redis reconnecting");
    });
  }
  return redisClient;
}

export async function pingRedis(): Promise<boolean> {
  try {
    if (!REDIS_URL) return false;
    const client = getRedis();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
