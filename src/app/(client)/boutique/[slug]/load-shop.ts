// src/app/(client)/boutique/[slug]/load-shop.ts — the shop of the public page /boutique/[slug],
// shared by generateMetadata and the page: memoised per request (React cache) and kept 60 s in
// Redis. Whether the page exists is decided by src/lib/shop-publication.ts.
import { cache } from "react";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isShopPageReachable } from "@/lib/shop-publication";

async function fetchShopFromDB(slug: string) {
  return prisma.shop.findUnique({
    where: { slug },
    // A platform metric the page never shows, and a BigInt that JSON.stringify cannot write to Redis.
    omit: { monthlyGmvCents: true },
    include: {
      categories: { orderBy: { order: "asc" } },
      products: {
        where: { isActive: true },
        include: {
          categories: true,
          images: { orderBy: { order: "asc" } },
          labels: true,
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

export type ShopWithProducts = NonNullable<Awaited<ReturnType<typeof fetchShopFromDB>>>;

/**
 * The shop of a cache entry. Upstash hands back the JSON already decoded; a string is decoded here,
 * and one that is not JSON (truncated, foreign) is a miss: logged, the shop is read again.
 */
function cachedShop(cacheKey: string, cached: unknown): ShopWithProducts | null {
  if (typeof cached !== "string") return cached as ShopWithProducts;
  try {
    return JSON.parse(cached) as ShopWithProducts;
  } catch (error) {
    logger.warn("[boutique] entrée Redis illisible, boutique relue en base", {
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** The shop from Redis (60 s) or the database. The Redis wrapper never throws: it logs and misses. */
async function getShop(slug: string): Promise<ShopWithProducts | null> {
  const cacheKey = `shop:${slug}`;
  const cached = await redis.get<unknown>(cacheKey);
  const hit = cached === null ? null : cachedShop(cacheKey, cached);
  if (hit) {
    // Restore Date objects
    for (const p of hit.products) {
      if (p.promoEnd) p.promoEnd = new Date(p.promoEnd);
    }
    return hit;
  }

  const shop = await fetchShopFromDB(slug);
  if (shop) await redis.set(cacheKey, JSON.stringify(shop), { ex: 60 });
  return shop;
}

/**
 * The shop with its categories and active products, or null when it does not exist or its page is
 * not reachable (suspended, unpublished): the page then takes its not-found path. The check runs
 * on a cached copy too, and every admin decision drops that copy
 * (src/lib/services/shops/moderation.ts), so a suspension or an unpublication applies at once.
 */
export const loadPublicShop = cache(async (slug: string): Promise<ShopWithProducts | null> => {
  const shop = await getShop(slug);
  return shop !== null && isShopPageReachable(shop) ? shop : null;
});
