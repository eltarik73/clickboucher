// src/lib/cache/shop-cache.ts — Redis copy (60 s) of the shop read by the page /boutique/[slug]
// (src/app/(client)/boutique/[slug]/load-shop.ts). The entry is the caller's Prisma row, dates
// included (./codec.ts), under a key that carries SHOP_CACHE_VERSION: a change to the caller's
// query (include, select) must bump it, else an entry written by the previous code would be read
// with the new type for up to 60 s. src/lib/redis.ts absorbs Redis errors and then reads null.
import { z } from "zod";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { decodeCacheValue, encodeCacheValue } from "./codec";

const SHOP_CACHE_VERSION = 3;
const SHOP_CACHE_TTL_SECONDS = 60;

const cachedShopShape = z.object({
  id: z.string(),
  slug: z.string(),
  products: z.array(z.object({ id: z.string() })),
});

function shopCacheKey(slug: string): string {
  return `shop:v${SHOP_CACHE_VERSION}:${slug}`;
}

/** The cached shop `slug`, or null on a miss. An unreadable entry is logged and is a miss. */
export async function readCachedShop<T extends { id: string; slug: string }>(
  slug: string
): Promise<T | null> {
  const key = shopCacheKey(slug);
  const raw = await redis.get<unknown>(key);
  if (raw === null) return null;
  const shop = decodeCacheValue(raw);
  const shape = cachedShopShape.safeParse(shop);
  if (!shape.success || shape.data.slug !== slug) {
    logger.warn("[shop-cache] unreadable entry ignored", { key });
    return null;
  }
  // Only writeCachedShop writes under this key, from the caller's row, and the key changes with
  // the caller's query (header): the entry is a value of type T.
  return shop as T;
}

export async function writeCachedShop(slug: string, shop: object): Promise<void> {
  await redis.set(shopCacheKey(slug), encodeCacheValue(shop), { ex: SHOP_CACHE_TTL_SECONDS });
}

/**
 * Drops the cached shop, after every decision that changes what its page shows or whether it
 * exists (admin moderation, vacation start and end): the page reads the database at once.
 */
export async function invalidateCachedShop(slug: string): Promise<void> {
  await redis.del(shopCacheKey(slug));
}
