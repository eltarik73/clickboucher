export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [shops, recipes, shopCities] = await Promise.all([
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
  ]);

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

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/bons-plans`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/bons-plans/anti-gaspi`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/promos`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/vente-flash`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/packs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/bons-plans/ramadan`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/recettes`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/espace-boucher`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/avantages`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/inscription-boucher`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/cgv`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/politique-de-confidentialite`,
      lastModified: new Date(),
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
    lastModified: new Date(),
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
