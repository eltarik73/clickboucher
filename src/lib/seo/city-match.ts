// Which SEO cities a shop belongs to. Shop.city is free text (« Lyon 7e », « CHAMBÉRY »): a shop
// belongs to every SEO city whose name its city contains, case-insensitively. This is the rule the
// city-family pages use to list their shops (Prisma `contains`, mode insensitive), so the sitemap's
// populated cities, the city lastmod and the validation ping agree with what the pages show.

import { SEO_CITIES } from "@/lib/seo/cities";

/**
 * Slugs of the SEO cities the shop city names, the longest city name first: the first slug is the
 * most specific match. Empty for a missing or blank city, or a city outside SEO_CITIES.
 */
export function seoCitySlugsForShopCity(shopCity: string | null | undefined): string[] {
  const normalized = shopCity?.trim().toLowerCase();
  if (!normalized) return [];
  return SEO_CITIES.filter((city) => normalized.includes(city.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)
    .map((city) => city.slug);
}
