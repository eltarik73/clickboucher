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
  /** OTP send: 2 req / minute (prevent brute force) */
  otpSend: createLimiter(60, 2),
  /** OTP verify: 5 req / 5 minutes (prevent code guessing) */
  otpVerify: createLimiter(300, 5),
  /** AI-powered endpoints (Anthropic, Replicate): 10 req / minute */
  ai: createLimiter(60, 10),
  /** Search endpoints: 30 req / minute */
  search: createLimiter(60, 30),
  /** Promo/code validation (prevent brute-force): 10 req / minute */
  promoValidate: createLimiter(60, 10),
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
