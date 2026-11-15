// src/app/(client)/boutique/[slug]/load-shop.ts — the shop of the public page /boutique/[slug],
// shared by generateMetadata and the page: memoised per request (React cache) and kept 60 s in
// Redis (src/lib/cache/shop-cache.ts, typed and versioned entries). Whether the page exists is
// decided by src/lib/shop-publication.ts.
import { cache } from "react";
import { readCachedShop, writeCachedShop } from "@/lib/cache/shop-cache";
import prisma from "@/lib/prisma";
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
 * The shop from Redis (60 s) or the database. A missing or unreadable entry is a miss; the Redis
 * client never throws (src/lib/redis.ts).
 */
async function getShop(slug: string): Promise<ShopWithProducts | null> {
  const cached = await readCachedShop<ShopWithProducts>(slug);
  if (cached !== null) return cached;
  const shop = await fetchShopFromDB(slug);
  if (shop !== null) await writeCachedShop(slug, shop);
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
