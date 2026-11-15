// The sitemap as data: every page submitted to search engines, with its lastmod and crawl hints.
// This pure builder feeds src/app/sitemap.ts, the IndexNow cron (src/lib/seo/indexnow-urls.ts) and
// the seo-audit cron; the database facts it needs come from src/lib/seo/sitemap-data.ts.
//
// URL set (the owner's decision, not changed here):
// - static pages, regional hub, departments, every city page, every partner page and every
//   occasion x city: always, with or without shops (business-critical pages, rule OR of the
//   seo-anti-penalty skill);
// - Sunday, product x city and district pages: only for a city with a listed shop (those pages
//   answer noindex without one);
// - indexable recipes only (src/lib/seo/recipes.ts);
// - never a shop page: every entry passes the submission policy, or the builder throws.
//
// lastmod is the day a page's content really changed, never a build date nor Shop.updatedAt
// (written by every status change and cron):
// - a template family: its content date below, bumped by hand only when its text really changes;
// - a city page: its content date, or the listing date of the newest shop of that city if later;
// - home: its content date or the newest listing of any shop; /bons-plans: the newest product
//   update; /recettes: the newest indexable recipe; occasions: their own lastUpdated; a recipe:
//   its updatedAt.

import { CITY_CONTENT_UPDATED, SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { seoCitySlugsForShopCity } from "@/lib/seo/city-match";
import { getCityDistrictCombinations } from "@/lib/seo/districts";
import { SEO_OCCASIONS, getOccasionCityCombinations } from "@/lib/seo/occasions";
import { getProductCityCombinations } from "@/lib/seo/products";
import {
  REGIONAL_HUB_PATH,
  STATIC_PUBLIC_PATHS,
  cityPath,
  departmentPath,
  districtPath,
  occasionCityPath,
  partnerPath,
  productCityPath,
  sundayPath,
} from "@/lib/seo/routes";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";

export type SitemapFamily =
  | "static"
  | "regional-hub"
  | "department"
  | "city"
  | "partner"
  | "district"
  | "sunday"
  | "product-city"
  | "occasion-city"
  | "recipe";

export type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type SitemapEntry = {
  path: string;
  family: SitemapFamily;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

/** Database facts of the sitemap: listed shops, indexable recipes, newest product update. */
export type SitemapData = {
  shops: { city: string; listedAt: Date }[];
  recipes: { slug: string; updatedAt: Date }[];
  latestProductUpdate: Date | null;
};

// Content dates (ISO day): the day the text of a family last really changed. Bump one only when
// that family's text changes, never for a deployment; IndexNow re-sends a page whose date moves.
export const REGIONAL_HUB_CONTENT_UPDATED = "2026-11-15";
export const DEPARTMENT_CONTENT_UPDATED = "2026-11-15";
export const PARTNER_CONTENT_UPDATED = "2026-11-15";
export const DISTRICT_CONTENT_UPDATED = "2026-11-15";
export const SUNDAY_CONTENT_UPDATED = "2026-11-15";
export const PRODUCT_CITY_CONTENT_UPDATED = "2026-11-15";
// City pages: SeoCity.lastUpdated ?? CITY_CONTENT_UPDATED (src/lib/seo/cities.ts).
// Occasion pages: SeoOccasion.lastUpdated (src/lib/seo/occasions.ts), required here.

/** What, besides its text, changes a static page: listed shops, products or recipes. */
type StaticFreshness = "listed-shops" | "products" | "recipes";

export type StaticPage = {
  contentUpdated: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  freshness?: StaticFreshness;
};

function staticPage(
  contentUpdated: string,
  changeFrequency: ChangeFrequency,
  priority: number,
  freshness?: StaticFreshness
): StaticPage {
  return { contentUpdated, changeFrequency, priority, freshness };
}

/**
 * One description per path of STATIC_PUBLIC_PATHS (src/lib/seo/routes.ts): content date, change
 * frequency, priority and, for a page that lists data, what else dates it.
 */
export const STATIC_PAGES: ReadonlyMap<string, StaticPage> = new Map([
  ["/", staticPage("2026-11-15", "weekly", 1, "listed-shops")],
  ["/bons-plans", staticPage("2026-04-22", "daily", 0.7, "products")],
  ["/recettes", staticPage("2026-11-15", "weekly", 0.7, "recipes")],
  ["/espace-boucher", staticPage("2026-04-22", "monthly", 0.6)],
  ["/contact", staticPage("2026-04-22", "yearly", 0.4)],
  ["/a-propos", staticPage("2026-11-15", "yearly", 0.4)],
  ["/presse", staticPage("2026-11-15", "monthly", 0.6)],
  ["/click-and-collect-halal", staticPage("2026-11-15", "weekly", 0.9)],
  ["/commander-viande-halal", staticPage("2026-11-15", "weekly", 0.9)],
  ["/trouver-boucherie-halal", staticPage("2026-11-15", "weekly", 0.9)],
  ["/inscription-boucher", staticPage("2026-04-22", "monthly", 0.5)],
  ["/cgv", staticPage("2026-01-01", "yearly", 0.3)],
  ["/mentions-legales", staticPage("2026-01-01", "yearly", 0.3)],
  ["/politique-de-confidentialite", staticPage("2026-01-01", "yearly", 0.3)],
]);

type HintedFamily = Exclude<SitemapFamily, "static">;

const HINTS: Record<HintedFamily, { changeFrequency: ChangeFrequency; priority: number }> = {
  "regional-hub": { changeFrequency: "weekly", priority: 0.9 },
  department: { changeFrequency: "weekly", priority: 0.85 },
  city: { changeFrequency: "weekly", priority: 0.8 },
  partner: { changeFrequency: "monthly", priority: 0.7 },
  district: { changeFrequency: "weekly", priority: 0.75 },
  sunday: { changeFrequency: "daily", priority: 0.75 },
  "product-city": { changeFrequency: "weekly", priority: 0.7 },
  "occasion-city": { changeFrequency: "weekly", priority: 0.7 },
  recipe: { changeFrequency: "monthly", priority: 0.6 },
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC of an ISO day. Throws on anything else: a content date is never guessed. */
function dayStart(isoDay: string): Date {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  if (!ISO_DAY.test(isoDay) || Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid content date "${isoDay}": expected an ISO day (YYYY-MM-DD)`);
  }
  return date;
}

function later(date: Date, other: Date | null | undefined): Date {
  return other !== null && other !== undefined && other > date ? other : date;
}

function newest(dates: Date[]): Date | null {
  return dates.reduce<Date | null>((acc, date) => (acc === null ? date : later(acc, date)), null);
}

/** Newest listing date of the shops of each SEO city, keyed by city slug. */
function newestListingByCity(shops: SitemapData["shops"]): Map<string, Date> {
  const byCity = new Map<string, Date>();
  for (const shop of shops) {
    for (const slug of seoCitySlugsForShopCity(shop.city)) {
      byCity.set(slug, later(shop.listedAt, byCity.get(slug)));
    }
  }
  return byCity;
}

const OCCASIONS_BY_SLUG = new Map(SEO_OCCASIONS.map((occasion) => [occasion.slug, occasion]));

function occasionContentDate(occasionSlug: string): Date {
  const lastUpdated = OCCASIONS_BY_SLUG.get(occasionSlug)?.lastUpdated;
  if (lastUpdated === undefined) {
    throw new Error(
      `The occasion "${occasionSlug}" has no lastUpdated: set the day its text changed`
    );
  }
  return dayStart(lastUpdated);
}

function familyEntry(family: HintedFamily, path: string, lastModified: Date): SitemapEntry {
  return { path, family, lastModified, ...HINTS[family] };
}

function staticEntry(path: string, freshness: Record<StaticFreshness, Date | null>): SitemapEntry {
  const page = STATIC_PAGES.get(path);
  if (page === undefined) throw new Error(`The static page ${path} has no entry in STATIC_PAGES`);
  const contentDate = dayStart(page.contentUpdated);
  return {
    path,
    family: "static",
    lastModified: page.freshness ? later(contentDate, freshness[page.freshness]) : contentDate,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  };
}

/** Throws on a URL the submission policy refuses or on a path listed twice. */
function checked(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>();
  for (const { path } of entries) {
    if (!isSubmittableToEngines(path)) {
      throw new Error(`Sitemap entry refused by the submission policy: "${path}"`);
    }
    if (seen.has(path)) throw new Error(`Sitemap entry listed twice: "${path}"`);
    seen.add(path);
  }
  return entries;
}

export function buildSitemapEntries(data: SitemapData): SitemapEntry[] {
  const listingByCity = newestListingByCity(data.shops);
  const isPopulated = (citySlug: string) => listingByCity.has(citySlug);
  const freshness: Record<StaticFreshness, Date | null> = {
    "listed-shops": newest(data.shops.map((shop) => shop.listedAt)),
    products: data.latestProductUpdate,
    recipes: newest(data.recipes.map((recipe) => recipe.updatedAt)),
  };

  return checked([
    ...STATIC_PUBLIC_PATHS.map((path) => staticEntry(path, freshness)),
    familyEntry("regional-hub", REGIONAL_HUB_PATH, dayStart(REGIONAL_HUB_CONTENT_UPDATED)),
    ...SEO_DEPARTMENTS.map((dept) =>
      familyEntry("department", departmentPath(dept.slug), dayStart(DEPARTMENT_CONTENT_UPDATED))
    ),
    ...SUNDAY_CITY_SLUGS.filter((slug) => isPopulated(slug)).map((slug) =>
      familyEntry("sunday", sundayPath(slug), dayStart(SUNDAY_CONTENT_UPDATED))
    ),
    ...getProductCityCombinations()
      .filter((combo) => isPopulated(combo.ville))
      .map((combo) =>
        familyEntry(
          "product-city",
          productCityPath(combo.produit, combo.ville),
          dayStart(PRODUCT_CITY_CONTENT_UPDATED)
        )
      ),
    ...getCityDistrictCombinations()
      .filter((combo) => isPopulated(combo.ville))
      .map((combo) =>
        familyEntry(
          "district",
          districtPath(combo.ville, combo.quartier),
          dayStart(DISTRICT_CONTENT_UPDATED)
        )
      ),
    ...getOccasionCityCombinations().map((combo) =>
      familyEntry(
        "occasion-city",
        occasionCityPath(combo.occasion, combo.ville),
        occasionContentDate(combo.occasion)
      )
    ),
    ...SEO_CITIES.map((city) =>
      familyEntry(
        "city",
        cityPath(city.slug),
        later(dayStart(city.lastUpdated ?? CITY_CONTENT_UPDATED), listingByCity.get(city.slug))
      )
    ),
    ...SEO_CITIES.map((city) =>
      familyEntry("partner", partnerPath(city.slug), dayStart(PARTNER_CONTENT_UPDATED))
    ),
    ...data.recipes.map((recipe) =>
      familyEntry("recipe", `/recettes/${recipe.slug}`, recipe.updatedAt)
    ),
  ]);
}

/** The entries whose lastModified is at or after `since`. */
export function entriesChangedSince(entries: SitemapEntry[], since: Date): SitemapEntry[] {
  return entries.filter((entry) => entry.lastModified.getTime() >= since.getTime());
}
