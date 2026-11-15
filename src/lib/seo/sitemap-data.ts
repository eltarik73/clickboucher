// Database facts of the sitemap (src/lib/seo/sitemap-entries.ts builds the URL set from them).
// Read by src/app/sitemap.ts and the IndexNow cron. No try/catch: a database error must fail the
// sitemap regeneration (ISR keeps serving the last good sitemap) or the cron run, never produce a
// sitemap or a ping list without its shops.

import prisma from "@/lib/prisma";
import { indexableRecipeWhere } from "@/lib/seo/recipes";
import type { SitemapData } from "@/lib/seo/sitemap-entries";

export async function loadSitemapData(): Promise<SitemapData> {
  const [shops, recipes, latestProduct] = await Promise.all([
    // Listed shops (Shop.visible, not suspended: src/lib/shop-publication.ts). A shop's listing
    // date is its validation, else its creation; never updatedAt, which every status write moves.
    prisma.shop.findMany({
      where: { visible: true, suspendedAt: null },
      select: { city: true, validatedAt: true, createdAt: true },
    }),
    prisma.recipe.findMany({
      where: indexableRecipeWhere,
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findFirst({
      where: { isActive: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    shops: shops.map((shop) => ({ city: shop.city, listedAt: shop.validatedAt ?? shop.createdAt })),
    recipes,
    latestProductUpdate: latestProduct?.updatedAt ?? null,
  };
}
