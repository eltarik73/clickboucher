// src/lib/redis.ts — Upstash Redis client with graceful fallback
import { Redis } from "@upstash/redis";

const hasRedisConfig =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a real Redis client if configured, otherwise null
const redisClient = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ── Wrapper that never crashes if Redis is absent ──
export const redis = {
  async get<T = string>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
      return await redisClient.get<T>(key);
    } catch (e) {
      console.warn("[Redis] get failed:", (e as Error).message);
      return null;
    }
  },

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<void> {
    if (!redisClient) return;
    try {
      if (opts?.ex) {
        await redisClient.set(key, value, { ex: opts.ex });
      } else {
        await redisClient.set(key, value);
      }
    } catch (e) {
      console.warn("[Redis] set failed:", (e as Error).message);
    }
  },

  async del(key: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(key);
    } catch (e) {
      console.warn("[Redis] del failed:", (e as Error).message);
    }
  },

  async publish(channel: string, message: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.publish(channel, message);
    } catch (e) {
      console.warn("[Redis] publish failed:", (e as Error).message);
    }
  },

  /** True if Redis is connected */
  get isAvailable(): boolean {
    return !!redisClient;
  },

  /** Raw client for advanced ops (ratelimit etc.) — may be null */
  get raw(): Redis | null {
    return redisClient;
  },
};
