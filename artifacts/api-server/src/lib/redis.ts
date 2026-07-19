import redis from "redis";
import { logger } from "./logger";

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 2) {
        logger.warn("Redis unavailable; disabling reconnections.");
        return false; // stop reconnecting
      }
      return 1000;
    },
  },
});

redisClient.on("error", (err) => {
  // Only log once to avoid spamming when Redis is not configured.
  if ((err as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
    logger.error({ err }, "Redis client error");
  }
});

export async function ensureRedis(): Promise<boolean> {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.warn({ err }, "Redis not available; continuing without event bus");
      return false;
    }
  }
  return redisClient.isReady;
}

export async function publishEvent(channel: string, payload: unknown): Promise<boolean> {
  const ready = await ensureRedis();
  if (!ready) return false;
  await redisClient.publish(
    channel,
    JSON.stringify({
      channel,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      payload,
    }),
  );
  return true;
}
