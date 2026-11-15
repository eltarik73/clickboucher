// Registry of the public pages whose list is closed: it is known from code and data alone,
// without the database. The programmatic routes (cities, districts, departments, Sunday,
// product x city, occasion x city, partner) build their generateStaticParams from the same data
// and declare dynamicParams = false, so a path outside this registry is a 404. Breadcrumbs only
// link to paths of this registry (src/lib/seo/breadcrumbs.ts).
//
// The path builders below are the one place where these URL shapes are written.

import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { SEO_DISTRICTS } from "@/lib/seo/districts";
import { getProductCityCombinations } from "@/lib/seo/products";
import { getOccasionCityCombinations } from "@/lib/seo/occasions";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";

export const HOME_PATH = "/";
export const REGIONAL_HUB_PATH = "/boucheries-halal-rhone-alpes";
export const PARTNER_HUB_PATH = "/espace-boucher";

/** Static public pages listed in the sitemap (the home page included). */
export const STATIC_PUBLIC_PATHS: readonly string[] = [
  HOME_PATH,
  "/bons-plans",
  "/recettes",
  PARTNER_HUB_PATH,
  "/contact",
  "/a-propos",
  "/presse",
  "/click-and-collect-halal",
  "/commander-viande-halal",
  "/trouver-boucherie-halal",
  "/inscription-boucher",
  "/cgv",
  "/mentions-legales",
  "/politique-de-confidentialite",
];

export function cityPath(citySlug: string): string {
  return `/boucherie-halal/${citySlug}`;
}

export function districtPath(citySlug: string, districtSlug: string): string {
  return `/boucherie-halal/${citySlug}/${districtSlug}`;
}

export function departmentPath(departmentSlug: string): string {
  return `/boucheries-halal/${departmentSlug}`;
}

export function sundayPath(citySlug: string): string {
  return `/boucheries-halal-ouvertes-dimanche/${citySlug}`;
}

export function productCityPath(productSlug: string, citySlug: string): string {
  return `/produits/${productSlug}/${citySlug}`;
}

export function occasionCityPath(occasionSlug: string, citySlug: string): string {
  return `/occasions/${occasionSlug}/${citySlug}`;
}

export function partnerPath(citySlug: string): string {
  return `/devenir-boucher-partenaire/${citySlug}`;
}

/** Shop pages depend on the database: they are not part of the closed registry. */
export function shopPath(shopSlug: string): string {
  return `/boutique/${shopSlug}`;
}

function buildClosedRoutePaths(): readonly string[] {
  return [
    ...STATIC_PUBLIC_PATHS,
    ...SEO_CITIES.map((city) => cityPath(city.slug)),
    ...SEO_DISTRICTS.map((district) => districtPath(district.citySlug, district.slug)),
    ...SEO_DEPARTMENTS.map((department) => departmentPath(department.slug)),
    REGIONAL_HUB_PATH,
    ...SUNDAY_CITY_SLUGS.map((citySlug) => sundayPath(citySlug)),
    ...getProductCityCombinations().map((combo) => productCityPath(combo.produit, combo.ville)),
    ...getOccasionCityCombinations().map((combo) => occasionCityPath(combo.occasion, combo.ville)),
    ...SEO_CITIES.map((city) => partnerPath(city.slug)),
  ];
}

type Registry = { paths: readonly string[]; set: ReadonlySet<string> };

// Built on first use: the data modules are constants, so the registry never changes.
let cachedRegistry: Registry | null = null;

function registry(): Registry {
  if (cachedRegistry === null) {
    const paths = buildClosedRoutePaths();
    cachedRegistry = { paths, set: new Set(paths) };
  }
  return cachedRegistry;
}

/** Every page of the closed registry, as site paths (« / », « /boucherie-halal/lyon »…). */
export function closedRoutePaths(): string[] {
  return [...registry().paths];
}

export function isClosedRoutePath(path: string): boolean {
  return registry().set.has(path);
}
