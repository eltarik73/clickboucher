// src/lib/redis-cache.ts — Generic Redis cache wrapper for heavy aggregations
// Falls back gracefully (calls fn directly) if Redis is unavailable.
import { redis } from "./redis";

/**
 * Cache the result of `fn` under `key` for `ttlSec` seconds.
 *
 * If Redis is unavailable or any cache op fails, this falls through to `fn()`.
 * Cache writes are fire-and-forget — never block the response.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis.isAvailable) return fn();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Fall through to compute
  }

  const value = await fn();

  // Fire-and-forget write
  redis.set(key, value, { ex: ttlSec }).catch(() => {});

  return value;
}

/**
 * Manually invalidate a cached key (e.g. after a mutation).
 */
export async function invalidateCached(key: string): Promise<void> {
  if (!redis.isAvailable) return;
  await redis.del(key).catch(() => {});
}
