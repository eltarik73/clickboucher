export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { getProductCityCombinations } from "@/lib/seo/products";
import { getCityDistrictCombinations } from "@/lib/seo/districts";
import { getOccasionCityCombinations } from "@/lib/seo/occasions";

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
      // Exclude AI-generated recipes that aren't manually featured —
      // Mars 2026 Core Update penalizes thin AI bulk content. We keep
      // the seeded hand-curated recipes (aiGenerated=false) AND any
      // AI recipe a webmaster has explicitly featured.
      where: { published: true, OR: [{ aiGenerated: false }, { featured: true }] },
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
        SEO_CITIES.filter((city) => c!.includes(city.name.toLowerCase())).map((city) => city.slug)
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
    // /bons-plans/{anti-gaspi,promos,vente-flash,packs,ramadan} are noindex
    // (transient promotional pages) — removed from sitemap to fix the
    // "submitted URL marked noindex" Search Console error (audit SEO HIGH #4).
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
    // /avantages is a private loyalty page (noindex) — removed from sitemap.
    {
      url: `${BASE_URL}/contact`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/a-propos`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/presse`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/click-and-collect-halal`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/commander-viande-halal`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/trouver-boucherie-halal`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.9,
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

  // Include ONLY SEO city pages with at least 1 visible shop.
  // Audit GSC mai 2026 : 11 pages "Explorée non indexée" + 69 "Détectée non
  // indexée" sur des villes vides (sans shop). Sources programmatic SEO 2026
  // (SEORAF, JourneyH, Metaflow) recommandent de noindex + exclude sitemap
  // les pages sans inventaire pour ne pas dégrader le signal qualité du
  // domaine (Mars 2026 Core Update penalise lourdement le thin content).
  // Les pages sont noindex côté code (cf generateMetadata) et flip à index
  // dès qu'un shop s'inscrit dans cette ville. Le re-add au sitemap se
  // fait alors automatiquement au prochain rebuild ISR.
  const cityPages: MetadataRoute.Sitemap = SEO_CITIES.filter((city) =>
    populatedCitySlugs.has(city.slug)
  ).map((city) => ({
    url: `${BASE_URL}/boucherie-halal/${city.slug}`,
    lastModified: latestShop?.updatedAt ?? STATIC_CONTENT_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Acquisition landing pages targeting bouchers in each SEO city.
  // SSG'd from SEO_CITIES + revalidate every hour.
  const becomePartnerPages: MetadataRoute.Sitemap = SEO_CITIES.map((city) => ({
    url: `${BASE_URL}/devenir-boucher-partenaire/${city.slug}`,
    lastModified: STATIC_CONTENT_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Hub régional + 5 hubs départementaux (annuaire local — Sprint 2-3).
  const regionalHub: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/boucheries-halal-rhone-alpes`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
  ];

  const departmentPages: MetadataRoute.Sitemap = SEO_DEPARTMENTS.map((dept) => ({
    url: `${BASE_URL}/boucheries-halal/${dept.slug}`,
    lastModified: STATIC_CONTENT_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  // Pages "ouverte dimanche" par ville (top 15 — Sprint 4).
  const SUNDAY_CITIES = [
    "lyon",
    "grenoble",
    "saint-etienne",
    "chambery",
    "annecy",
    "aix-les-bains",
    "villeurbanne",
    "venissieux",
    "vaulx-en-velin",
    "annemasse",
    "voiron",
    "echirolles",
    "bron",
    "saint-priest",
    "bourgoin-jallieu",
  ];
  // Best practice 2026 : exclure les villes sans shop des sitemaps programmatic.
  // Mars 2026 Core Update penalise le thin content. Pages restent accessibles
  // par URL directe (acquisition boucher), juste pas pushed à Google.
  // Sources : NicoDigital, SEOteric, JourneyH Marketplace Playbook.
  const sundayPages: MetadataRoute.Sitemap = SUNDAY_CITIES.filter((slug) =>
    populatedCitySlugs.has(slug)
  ).map((slug) => ({
    url: `${BASE_URL}/boucheries-halal-ouvertes-dimanche/${slug}`,
    lastModified: STATIC_CONTENT_UPDATED,
    changeFrequency: "daily" as const, // horaires changent souvent
    priority: 0.75,
  }));

  // Pages produit × ville (Sprint 5) — filtre par populatedCitySlugs
  const productCityPages: MetadataRoute.Sitemap = getProductCityCombinations()
    .filter((combo) => populatedCitySlugs.has(combo.ville))
    .map((combo) => ({
      url: `${BASE_URL}/produits/${combo.produit}/${combo.ville}`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Pages quartier (Sprint 6) — filtre par populatedCitySlugs (ville parent)
  const districtPages: MetadataRoute.Sitemap = getCityDistrictCombinations()
    .filter((combo) => populatedCitySlugs.has(combo.ville))
    .map((combo) => ({
      url: `${BASE_URL}/boucherie-halal/${combo.ville}/${combo.quartier}`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));

  // Pages occasion × ville (Sprint 7) — filtre par populatedCitySlugs
  const occasionPages: MetadataRoute.Sitemap = getOccasionCityCombinations()
    .filter((combo) => populatedCitySlugs.has(combo.ville))
    .map((combo) => ({
      url: `${BASE_URL}/occasions/${combo.occasion}/${combo.ville}`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const recipePages: MetadataRoute.Sitemap = recipes.map((r) => ({
    url: `${BASE_URL}/recettes/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...regionalHub,
    ...departmentPages,
    ...sundayPages,
    ...productCityPages,
    ...districtPages,
    ...occasionPages,
    ...shopPages,
    ...cityPages,
    ...becomePartnerPages,
    ...recipePages,
  ];
}
