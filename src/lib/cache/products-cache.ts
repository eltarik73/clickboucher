// src/lib/cache/products-cache.ts — Redis copy (60 s) of the public product list of a shop, read
// by GET /api/products for visitors without filter. The entry is the rows as read, dates included
// (./codec.ts): the caller settles them at each read, so that an anti-gaspi ending within the 60 s
// is over at once. The key carries PRODUCTS_CACHE_VERSION: a change to the caller's select must
// bump it, else an entry written by the previous code would be read with the new type for up to
// 60 s. src/lib/redis.ts absorbs Redis errors and then reads null.
import { z } from "zod";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { decodeCacheValue, encodeCacheValue } from "./codec";

const PRODUCTS_CACHE_VERSION = 2;
const PRODUCTS_CACHE_TTL_SECONDS = 60;

const cachedRowsShape = z.array(z.object({ id: z.string() }));

function productsCacheKey(shopId: string): string {
  return `products:shop:v${PRODUCTS_CACHE_VERSION}:${shopId}`;
}

/** The cached rows of the shop, or null on a miss. An unreadable entry is logged and is a miss. */
export async function readCachedProducts<T extends { id: string }>(
  shopId: string
): Promise<T[] | null> {
  const key = productsCacheKey(shopId);
  const raw = await redis.get<unknown>(key);
  if (raw === null) return null;
  const rows = decodeCacheValue(raw);
  if (!cachedRowsShape.safeParse(rows).success) {
    logger.warn("[products-cache] unreadable entry ignored", { key });
    return null;
  }
  // Only writeCachedProducts writes under this key, from the caller's rows, and the key changes
  // with the caller's select (header): the entry is a list of values of type T.
  return rows as T[];
}

export async function writeCachedProducts(
  shopId: string,
  rows: readonly { id: string }[]
): Promise<void> {
  await redis.set(productsCacheKey(shopId), encodeCacheValue(rows), {
    ex: PRODUCTS_CACHE_TTL_SECONDS,
  });
}

/** Drops the cached list, after a change to the products the shop shows. */
export async function invalidateCachedProducts(shopId: string): Promise<void> {
  await redis.del(productsCacheKey(shopId));
}
