// Breadcrumb trails of the public SEO pages (visible trail and BreadcrumbList JSON-LD).
//
// Trails follow the site's real hierarchy: home > department hub > city > page, the department
// hub sitting under the regional hub. Every crumb links to a page of the closed route registry
// (src/lib/seo/routes.ts), so a trail can never point to a 404 like the former « /produits »
// or « /occasions/aid-al-adha » crumbs; a builder throws instead of emitting such a link. The
// only page outside the registry is the shop page itself, last crumb of shopBreadcrumb.

import {
  SEO_CITIES,
  getDepartmentForCity,
  type SeoCity,
  type SeoDepartment,
} from "@/lib/seo/cities";
import type { SeoDistrict } from "@/lib/seo/districts";
import type { SeoProduct } from "@/lib/seo/products";
import type { SeoOccasion } from "@/lib/seo/occasions";
import { SITE_URL, absoluteUrl } from "@/lib/seo/site";
import {
  HOME_PATH,
  PARTNER_HUB_PATH,
  REGIONAL_HUB_PATH,
  cityPath,
  departmentPath,
  districtPath,
  isClosedRoutePath,
  occasionCityPath,
  partnerPath,
  productCityPath,
  shopPath,
  sundayPath,
} from "@/lib/seo/routes";

/** One crumb: its label and its absolute URL. */
export type Crumb = { name: string; url: string };

const HOME_CRUMB_NAME = "Accueil";
const REGIONAL_HUB_CRUMB_NAME = "Boucheries halal Rhône-Alpes";

function crumb(name: string, path: string): Crumb {
  return { name, url: absoluteUrl(path) };
}

function sitePathOf(url: string): string {
  return url === SITE_URL ? HOME_PATH : url.slice(SITE_URL.length);
}

/** Returns the trail after checking that each crumb links to an existing page. */
function existing(trail: Crumb[], openLastCrumb = false): Crumb[] {
  const checked = openLastCrumb ? trail.slice(0, -1) : trail;
  for (const { url } of checked) {
    if (!url.startsWith(SITE_URL) || !isClosedRoutePath(sitePathOf(url))) {
      throw new Error(`Breadcrumb link to a page that does not exist: ${url}`);
    }
  }
  return trail;
}

/** The department of a SEO city. Throws when the city belongs to no department. */
export function departmentOfCity(citySlug: string): SeoDepartment {
  const department = getDepartmentForCity(citySlug);
  if (department === undefined) {
    throw new Error(`The SEO city "${citySlug}" belongs to no department of SEO_DEPARTMENTS`);
  }
  return department;
}

function homeCrumb(): Crumb {
  return crumb(HOME_CRUMB_NAME, HOME_PATH);
}

function departmentCrumb(dept: SeoDepartment): Crumb {
  return crumb(`Boucheries halal ${dept.name}`, departmentPath(dept.slug));
}

function cityCrumb(city: SeoCity): Crumb {
  return crumb(city.name, cityPath(city.slug));
}

/** Home > department > city: the head of every city-based trail. */
function cityTrail(city: SeoCity): Crumb[] {
  return [homeCrumb(), departmentCrumb(departmentOfCity(city.slug)), cityCrumb(city)];
}

export function cityBreadcrumb(city: SeoCity): Crumb[] {
  return existing(cityTrail(city));
}

export function districtBreadcrumb(city: SeoCity, district: SeoDistrict): Crumb[] {
  if (district.citySlug !== city.slug) {
    throw new Error(
      `The district "${district.slug}" belongs to "${district.citySlug}", not "${city.slug}"`
    );
  }
  return existing([
    ...cityTrail(city),
    crumb(district.name, districtPath(city.slug, district.slug)),
  ]);
}

export function departmentBreadcrumb(dept: SeoDepartment): Crumb[] {
  return existing([
    homeCrumb(),
    crumb(REGIONAL_HUB_CRUMB_NAME, REGIONAL_HUB_PATH),
    departmentCrumb(dept),
  ]);
}

export function sundayBreadcrumb(city: SeoCity): Crumb[] {
  return existing([...cityTrail(city), crumb("Ouvertes le dimanche", sundayPath(city.slug))]);
}

export function productCityBreadcrumb(product: SeoProduct, city: SeoCity): Crumb[] {
  return existing([
    ...cityTrail(city),
    crumb(product.name, productCityPath(product.slug, city.slug)),
  ]);
}

export function occasionCityBreadcrumb(occasion: SeoOccasion, city: SeoCity): Crumb[] {
  return existing([
    ...cityTrail(city),
    crumb(occasion.name, occasionCityPath(occasion.slug, city.slug)),
  ]);
}

export function partnerBreadcrumb(city: SeoCity): Crumb[] {
  return existing([
    homeCrumb(),
    crumb("Espace boucher", PARTNER_HUB_PATH),
    crumb(`Boucher partenaire à ${city.name}`, partnerPath(city.slug)),
  ]);
}

// The SEO city a shop's free-text city designates: the one whose name the shop city contains,
// case-insensitively (the sitemap's rule), the longest name winning when several match.
function seoCityOfShop(shopCity: string | null): SeoCity | undefined {
  const normalized = shopCity?.toLowerCase().trim();
  if (!normalized) return undefined;
  return SEO_CITIES.filter((city) => normalized.includes(city.name.toLowerCase())).sort(
    (a, b) => b.name.length - a.name.length
  )[0];
}

/** Home > [department > city, when the shop's city is a SEO city] > shop. */
export function shopBreadcrumb(shop: { name: string; slug: string; city: string | null }): Crumb[] {
  const city = seoCityOfShop(shop.city);
  return existing(
    [...(city ? cityTrail(city) : [homeCrumb()]), crumb(shop.name, shopPath(shop.slug))],
    true
  );
}
