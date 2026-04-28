export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Fixed "content update" dates for static legal/marketing pages. Bumped
// manually when page copy meaningfully changes — keeps lastmod signal honest.
const STATIC_CONTENT_UPDATED = new Date("2026-04-22T00:00:00Z");
const LEGAL_CONTENT_UPDATED = new Date("2026-01-01T00:00:00Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [shops, recipes, shopCities, latestShop, latestProduct] = await Promise.all([
    prisma.shop.findMany({
    where: { visible: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  }),
    prisma.recipe.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    // Only list SEO cities that have at least one visible shop — otherwise
    // the page is thin/empty and hurts E-E-A-T + crawl budget.
    prisma.shop.findMany({
      where: { visible: true },
      select: { city: true },
    }),
    // Use the freshest shop change as the homepage lastmod signal
    prisma.shop.findFirst({
      where: { visible: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    // Use the freshest product change as the bons-plans lastmod signal
    prisma.product.findFirst({
      where: { isActive: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const homeLastMod = latestShop?.updatedAt ?? STATIC_CONTENT_UPDATED;
  const bonsPlansLastMod = latestProduct?.updatedAt ?? STATIC_CONTENT_UPDATED;

  const populatedCitySlugs = new Set(
    shopCities
      .map((s) => s.city?.toLowerCase().trim())
      .filter(Boolean)
      .flatMap((c) =>
        SEO_CITIES.filter((city) =>
          c!.includes(city.name.toLowerCase())
        ).map((city) => city.slug)
      )
  );

  const latestRecipeDate = recipes.reduce<Date | null>((acc, r) => {
    if (!acc || r.updatedAt > acc) return r.updatedAt;
    return acc;
  }, null);
  const recipesIndexLastMod = latestRecipeDate ?? STATIC_CONTENT_UPDATED;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: homeLastMod,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/bons-plans`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/bons-plans/anti-gaspi`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/promos`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/vente-flash`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/packs`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/ramadan`,
      lastModified: bonsPlansLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/recettes`,
      lastModified: recipesIndexLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/espace-boucher`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/avantages`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/presse`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/inscription-boucher`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/cgv`,
      lastModified: LEGAL_CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/mentions-legales`,
      lastModified: LEGAL_CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/politique-de-confidentialite`,
      lastModified: LEGAL_CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const shopPages: MetadataRoute.Sitemap = shops.map((shop) => ({
    url: `${BASE_URL}/boutique/${shop.slug}`,
    lastModified: shop.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const cityPages: MetadataRoute.Sitemap = SEO_CITIES.filter((city) =>
    populatedCitySlugs.has(city.slug)
  ).map((city) => ({
    url: `${BASE_URL}/boucherie-halal/${city.slug}`,
    // City pages inherit the freshness of the most recently updated shop
    // (content is derived from the shop list for that city).
    lastModified: latestShop?.updatedAt ?? STATIC_CONTENT_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const recipePages: MetadataRoute.Sitemap = recipes.map((r) => ({
    url: `${BASE_URL}/recettes/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...shopPages, ...cityPages, ...recipePages];
}
