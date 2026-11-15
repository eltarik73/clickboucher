// @vitest-environment node
// Guard: the programmatic SEO pages never link to a 404 and never carry a bad title (FIX-09, FIX-16).
//
// Search Console listed /produits and /occasions/aid-al-adha as 404s: the product and occasion
// pages linked them from their BreadcrumbList. This test reads the JSON-LD every page of each
// family emits (the content modules the pages render, or the builder the page calls), and checks
// every BreadcrumbList item and every ItemList link against the closed route registry
// (src/lib/seo/routes.ts). It then checks that the registry is exactly what the routes build:
// the paths of each closed-list route's generateStaticParams (dynamicParams = false, so nothing
// else answers) and a page file for each static path. A registry path is therefore a real page.
// Last, every generated title fits in TITLE_MAX characters and none says « halal halal ».
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as cityRoute from "@/app/boucherie-halal/[ville]/page";
import * as districtRoute from "@/app/boucherie-halal/[ville]/[quartier]/page";
import * as departmentRoute from "@/app/boucheries-halal/[departement]/page";
import * as sundayRoute from "@/app/boucheries-halal-ouvertes-dimanche/[ville]/page";
import * as productCityRoute from "@/app/produits/[produit]/[ville]/page";
import * as occasionCityRoute from "@/app/occasions/[occasion]/[ville]/page";
import * as partnerRoute from "@/app/devenir-boucher-partenaire/[ville]/page";
import { partnerBreadcrumb } from "@/lib/seo/breadcrumbs";
import { SEO_CITIES, SEO_DEPARTMENTS, type SeoCity } from "@/lib/seo/cities";
import { cityPageContent } from "@/lib/seo/content/city";
import { departmentPageContent } from "@/lib/seo/content/department";
import { districtPageContent } from "@/lib/seo/content/district";
import { occasionCityContent } from "@/lib/seo/content/occasion-city";
import { productCityContent } from "@/lib/seo/content/product-city";
import { REGIONAL_HUB_TITLE, regionalHubContent } from "@/lib/seo/content/regional-hub";
import { sundayPageContent } from "@/lib/seo/content/sunday";
import { SEO_DISTRICTS } from "@/lib/seo/districts";
import { breadcrumbJsonLd, type JsonLdObject } from "@/lib/seo/jsonld/pages";
import { SEO_OCCASIONS, getOccasionCityCombinations, type SeoOccasion } from "@/lib/seo/occasions";
import { SEO_PRODUCTS, getProductCityCombinations, type SeoProduct } from "@/lib/seo/products";
import {
  REGIONAL_HUB_PATH,
  STATIC_PUBLIC_PATHS,
  cityPath,
  closedRoutePaths,
  departmentPath,
  districtPath,
  isClosedRoutePath,
  occasionCityPath,
  partnerPath,
  productCityPath,
  sundayPath,
} from "@/lib/seo/routes";
import { SITE_URL } from "@/lib/seo/site";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";
import {
  TITLE_MAX,
  cityTitle,
  departmentTitle,
  districtTitle,
  occasionCityDescription,
  occasionCityTitle,
  partnerTitle,
  productCityDescription,
  productCityTitle,
  sundayTitle,
} from "@/lib/seo/titles";
import { ROOT } from "./source-scan";

function bySlug<T extends { slug: string }>(list: readonly T[], slug: string, kind: string): T {
  const found = list.find((item) => item.slug === slug);
  if (found === undefined) throw new Error(`test setup: unknown ${kind} ${slug}`);
  return found;
}

const city = (slug: string): SeoCity => bySlug(SEO_CITIES, slug, "city");
const product = (slug: string): SeoProduct => bySlug(SEO_PRODUCTS, slug, "product");
const occasion = (slug: string): SeoOccasion => bySlug(SEO_OCCASIONS, slug, "occasion");

type PageMarkup = { family: string; path: string; jsonLd: JsonLdObject[] };

// The JSON-LD each page renders. The shop count only changes sentences, never a link: 0 is the
// case every page must survive (rule OR: the pages stay published without any shop).
const PAGES: readonly PageMarkup[] = [
  ...SEO_CITIES.map((c) => ({
    family: "city",
    path: cityPath(c.slug),
    jsonLd: cityPageContent(c, 0).jsonLd,
  })),
  ...SEO_DISTRICTS.map((d) => ({
    family: "district",
    path: districtPath(d.citySlug, d.slug),
    jsonLd: districtPageContent(city(d.citySlug), d, { shown: 0, inDistrict: false }).jsonLd,
  })),
  ...SEO_DEPARTMENTS.map((dept) => ({
    family: "department",
    path: departmentPath(dept.slug),
    jsonLd: departmentPageContent(dept, 0).jsonLd,
  })),
  { family: "regional hub", path: REGIONAL_HUB_PATH, jsonLd: regionalHubContent(0).jsonLd },
  ...SUNDAY_CITY_SLUGS.map((slug) => ({
    family: "sunday",
    path: sundayPath(slug),
    jsonLd: sundayPageContent(city(slug), 0).jsonLd,
  })),
  ...getProductCityCombinations().map(({ produit, ville }) => ({
    family: "product x city",
    path: productCityPath(produit, ville),
    jsonLd: productCityContent(product(produit), city(ville), 0).jsonLd,
  })),
  ...getOccasionCityCombinations().map(({ occasion: slug, ville }) => ({
    family: "occasion x city",
    path: occasionCityPath(slug, ville),
    jsonLd: occasionCityContent(occasion(slug), city(ville), 0).jsonLd,
  })),
  ...SEO_CITIES.map((c) => ({
    family: "partner",
    path: partnerPath(c.slug),
    jsonLd: [breadcrumbJsonLd(partnerBreadcrumb(c))],
  })),
];

type Link = { kind: "breadcrumb" | "list"; url: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listItems(node: Record<string, unknown>): Record<string, unknown>[] {
  const items = node.itemListElement;
  return Array.isArray(items) ? items.filter(isObject) : [];
}

/** Every breadcrumb item and every list link found anywhere in the JSON-LD. */
function linksOf(value: unknown): Link[] {
  if (Array.isArray(value)) return value.flatMap(linksOf);
  if (!isObject(value)) return [];
  const own: Link[] = [];
  if (value["@type"] === "BreadcrumbList") {
    for (const item of listItems(value)) own.push({ kind: "breadcrumb", url: String(item.item) });
  }
  if (value["@type"] === "ItemList") {
    for (const item of listItems(value)) own.push({ kind: "list", url: String(item.url) });
  }
  return [...own, ...Object.values(value).flatMap(linksOf)];
}

function sitePath(url: string): string | null {
  if (url === SITE_URL) return "/";
  return url.startsWith(`${SITE_URL}/`) ? url.slice(SITE_URL.length) : null;
}

describe("every link of the programmatic pages' JSON-LD is a page of the registry", () => {
  it("covers every page of the eight families", () => {
    const families = new Set(PAGES.map((page) => page.family));
    expect([...families].sort()).toEqual(
      [
        "city",
        "department",
        "district",
        "occasion x city",
        "partner",
        "product x city",
        "regional hub",
        "sunday",
      ].sort()
    );
    expect(PAGES.map((page) => page.path).sort()).toEqual(
      closedRoutePaths()
        .filter((p) => !STATIC_PUBLIC_PATHS.includes(p))
        .sort()
    );
  });

  it.each(PAGES.map((page) => [page.path, page] as const))("%s", (_path, page) => {
    const links = linksOf(page.jsonLd);
    const crumbs = links.filter((link) => link.kind === "breadcrumb");
    expect(crumbs.length, "a BreadcrumbList with at least the home page").toBeGreaterThan(1);
    expect(crumbs[0].url, "the trail starts at the home page").toBe(SITE_URL);
    expect(crumbs.at(-1)?.url, "the trail ends on the page itself").toBe(`${SITE_URL}${page.path}`);
    for (const link of links) {
      const linked = sitePath(link.url);
      expect(linked, `${link.kind} link off the site: ${link.url}`).not.toBeNull();
      expect(isClosedRoutePath(linked ?? ""), `${link.kind} link to a 404: ${link.url}`).toBe(true);
    }
  });

  it("puts every city-based page under its city and department, never under /produits or /occasions", () => {
    for (const page of PAGES) {
      const trail = linksOf(page.jsonLd)
        .filter((link) => link.kind === "breadcrumb")
        .map((link) => sitePath(link.url));
      expect(trail, page.path).not.toContain("/produits");
      expect(trail, page.path).not.toContain("/occasions");
      if (["district", "sunday", "product x city", "occasion x city"].includes(page.family)) {
        expect(trail[1], page.path).toMatch(/^\/boucheries-halal\/[a-z-]+$/);
        expect(trail[2], page.path).toMatch(/^\/boucherie-halal\/[a-z-]+$/);
      }
    }
  });
});

type ClosedRoute = {
  dynamicParams: boolean;
  generateStaticParams: () => Promise<Record<string, string>[]>;
};
type ToPath = (params: Record<string, string>) => string;

const CLOSED_ROUTES: readonly (readonly [string, ClosedRoute, ToPath])[] = [
  ["boucherie-halal/[ville]", cityRoute, (p) => cityPath(p.ville)],
  ["boucherie-halal/[ville]/[quartier]", districtRoute, (p) => districtPath(p.ville, p.quartier)],
  ["boucheries-halal/[departement]", departmentRoute, (p) => departmentPath(p.departement)],
  ["boucheries-halal-ouvertes-dimanche/[ville]", sundayRoute, (p) => sundayPath(p.ville)],
  ["produits/[produit]/[ville]", productCityRoute, (p) => productCityPath(p.produit, p.ville)],
  ["occasions/[occasion]/[ville]", occasionCityRoute, (p) => occasionCityPath(p.occasion, p.ville)],
  ["devenir-boucher-partenaire/[ville]", partnerRoute, (p) => partnerPath(p.ville)],
];

/** URL paths of the static page files of src/app (route groups removed, dynamic segments skipped). */
function staticPagePaths(dir: string, segments: string[] = []): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) {
      return entry.name === "page.tsx" ? [`/${segments.join("/")}`] : [];
    }
    if (!entry.isDirectory() || entry.name.includes("[") || entry.name.startsWith("_")) return [];
    const group = entry.name.startsWith("(") && entry.name.endsWith(")");
    return staticPagePaths(
      path.join(dir, entry.name),
      group ? segments : [...segments, entry.name]
    );
  });
}

describe("the registry is exactly the set of pages the routes build", () => {
  it.each(CLOSED_ROUTES)("%s: dynamicParams = false", (_name, route) => {
    expect(route.dynamicParams).toBe(false);
  });

  it("lists the static pages and exactly the pages the closed routes generate", async () => {
    const generated = await Promise.all(
      CLOSED_ROUTES.map(async ([, route, toPath]) =>
        (await route.generateStaticParams()).map(toPath)
      )
    );
    expect([...STATIC_PUBLIC_PATHS, REGIONAL_HUB_PATH, ...generated.flat()].sort()).toEqual(
      closedRoutePaths().sort()
    );
  });

  it("has a page file for every static path and the regional hub", () => {
    const pages = new Set(staticPagePaths(path.join(ROOT, "src/app")));
    for (const staticPath of [...STATIC_PUBLIC_PATHS, REGIONAL_HUB_PATH]) {
      expect(pages.has(staticPath), staticPath).toBe(true);
    }
  });
});

const TITLES: readonly { page: string; title: string }[] = [
  ...SEO_CITIES.map((c) => ({ page: cityPath(c.slug), title: cityTitle(c) })),
  ...SEO_DISTRICTS.map((d) => ({
    page: districtPath(d.citySlug, d.slug),
    title: districtTitle(d),
  })),
  ...SEO_DEPARTMENTS.map((d) => ({ page: departmentPath(d.slug), title: departmentTitle(d) })),
  { page: REGIONAL_HUB_PATH, title: REGIONAL_HUB_TITLE },
  ...SUNDAY_CITY_SLUGS.map((slug) => ({ page: sundayPath(slug), title: sundayTitle(city(slug)) })),
  ...getProductCityCombinations().map(({ produit, ville }) => ({
    page: productCityPath(produit, ville),
    title: productCityTitle(product(produit), city(ville)),
  })),
  ...getOccasionCityCombinations().map(({ occasion: slug, ville }) => ({
    page: occasionCityPath(slug, ville),
    title: occasionCityTitle(occasion(slug), city(ville)),
  })),
  ...SEO_CITIES.map((c) => ({ page: partnerPath(c.slug), title: partnerTitle(c) })),
];

const HALAL_TWICE = /halal\s+halal/i;

describe("titles of the generated pages", () => {
  it.each(TITLES.map((entry) => [entry.page, entry.title] as const))(
    "%s: « %s »",
    (_page, title) => {
      expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(title).not.toMatch(HALAL_TWICE);
    }
  );

  it("never says « halal halal » in an occasion or product description", () => {
    for (const { occasion: slug, ville } of getOccasionCityCombinations()) {
      expect(occasionCityDescription(occasion(slug), city(ville))).not.toMatch(HALAL_TWICE);
    }
    for (const { produit, ville } of getProductCityCombinations()) {
      expect(productCityDescription(product(produit), city(ville))).not.toMatch(HALAL_TWICE);
    }
  });
});
