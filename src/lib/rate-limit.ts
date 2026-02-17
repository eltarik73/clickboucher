// src/lib/rate-limit.ts — Uber Eats style rate limiting via Upstash
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Only create rate limiters if Redis is available
function createLimiter(window: number, limit: number) {
  if (!redis.raw) return null;
  return new Ratelimit({
    redis: redis.raw,
    limiter: Ratelimit.slidingWindow(limit, `${window} s`),
    analytics: false,
  });
}

export const rateLimits = {
  /** General API: 30 req / minute */
  api: createLimiter(60, 30),
  /** Order creation: 5 req / minute */
  orders: createLimiter(60, 5),
  /** AI Chat: 3 req / minute */
  aiChat: createLimiter(60, 3),
};

/**
 * Check rate limit. Returns { success: true } if no Redis or within limit.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining?: number }> {
  if (!limiter) return { success: true };
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success, remaining: result.remaining };
  } catch (e) {
    console.warn("[RateLimit] check failed:", (e as Error).message);
    return { success: true }; // Fail open
  }
}
