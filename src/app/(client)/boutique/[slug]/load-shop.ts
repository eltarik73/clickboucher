// src/app/(client)/boutique/[slug]/load-shop.ts — the shop of the public page /boutique/[slug],
// shared by generateMetadata and the page: memoised per request (React cache) and kept 60 s in
// Redis. Whether the page exists is decided by src/lib/shop-publication.ts.
import { cache } from "react";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isShopPageReachable } from "@/lib/shop-publication";

async function fetchShopFromDB(slug: string) {
  return prisma.shop.findUnique({
    where: { slug },
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

async function getShop(slug: string): Promise<ShopWithProducts | null> {
  // Try Redis cache first (TTL 60s)
  const cacheKey = `shop:${slug}`;
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const parsed = (typeof cached === "string" ? JSON.parse(cached) : cached) as ShopWithProducts;
      // Restore Date objects
      if (parsed?.products) {
        for (const p of parsed.products) {
          if (p.promoEnd) p.promoEnd = new Date(p.promoEnd);
        }
      }
      return parsed;
    }
  } catch {}

  const shop = await fetchShopFromDB(slug);

  // Cache for 60 seconds
  if (shop) {
    try {
      await redis.set(cacheKey, JSON.stringify(shop), { ex: 60 });
    } catch {}
  }

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
