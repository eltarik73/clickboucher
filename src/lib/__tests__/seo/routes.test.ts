// @vitest-environment node
//
// The closed route registry: every page known without the database. Breadcrumbs may only link
// inside it, and the programmatic routes declare dynamicParams = false on the same data.

import { describe, it, expect } from "vitest";
import {
  STATIC_PUBLIC_PATHS,
  closedRoutePaths,
  isClosedRoutePath,
  shopPath,
} from "@/lib/seo/routes";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { SEO_DISTRICTS } from "@/lib/seo/districts";
import { PRODUCT_VILLE_PRIORITY_SLUGS, SEO_PRODUCTS } from "@/lib/seo/products";
import { OCCASION_VILLE_PRIORITY_SLUGS, SEO_OCCASIONS } from "@/lib/seo/occasions";

const citySlugs = new Set(SEO_CITIES.map((city) => city.slug));

describe("closedRoutePaths", () => {
  const paths = closedRoutePaths();

  it("has no duplicate", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("contains the business-critical pages", () => {
    for (const path of [
      "/",
      "/boucherie-halal/chambery",
      "/boucherie-halal/lyon",
      "/boucheries-halal/savoie",
      "/boucheries-halal-rhone-alpes",
      "/espace-boucher",
      "/devenir-boucher-partenaire/chambery",
      "/occasions/aid-al-adha/chambery",
    ]) {
      expect(paths, path).toContain(path);
    }
  });

  it("contains neither the missing /produits and /occasions indexes nor any shop page", () => {
    expect(paths).not.toContain("/produits");
    expect(paths).not.toContain("/occasions");
    expect(paths.some((path) => path.startsWith("/boutique"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/api/"))).toBe(false);
  });

  it("covers one page per item of each family", () => {
    const count = (prefix: string) => paths.filter((path) => path.startsWith(prefix)).length;
    expect(count("/boucherie-halal/")).toBe(SEO_CITIES.length + SEO_DISTRICTS.length);
    expect(count("/boucheries-halal/")).toBe(SEO_DEPARTMENTS.length);
    expect(count("/boucheries-halal-ouvertes-dimanche/")).toBe(SUNDAY_CITY_SLUGS.length);
    expect(count("/produits/")).toBe(SEO_PRODUCTS.length * PRODUCT_VILLE_PRIORITY_SLUGS.length);
    expect(count("/occasions/")).toBe(SEO_OCCASIONS.length * OCCASION_VILLE_PRIORITY_SLUGS.length);
    expect(count("/devenir-boucher-partenaire/")).toBe(SEO_CITIES.length);
    for (const path of STATIC_PUBLIC_PATHS) expect(paths).toContain(path);
  });

  it("writes every path as a clean site path", () => {
    for (const path of paths) {
      expect(path, path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
    }
  });

  it("returns a copy the caller cannot use to alter the registry", () => {
    const copy = closedRoutePaths();
    copy.push("/boutique/injected");
    expect(isClosedRoutePath("/boutique/injected")).toBe(false);
  });
});

describe("isClosedRoutePath", () => {
  it("answers true for a registry page and false for anything else", () => {
    expect(isClosedRoutePath("/boucherie-halal/chambery")).toBe(true);
    expect(isClosedRoutePath("/boucheries-halal-rhone-alpes")).toBe(true);
    expect(isClosedRoutePath("/boucherie-halal/ville-inexistante")).toBe(false);
    expect(isClosedRoutePath("/occasions/aid-al-adha")).toBe(false);
    expect(isClosedRoutePath(shopPath("el-mektoub"))).toBe(false);
    expect(isClosedRoutePath("/boucherie-halal/chambery/")).toBe(false);
  });
});

describe("data behind the closed routes", () => {
  it("lists only SEO cities as Sunday cities, once each", () => {
    expect(new Set(SUNDAY_CITY_SLUGS).size).toBe(SUNDAY_CITY_SLUGS.length);
    for (const slug of SUNDAY_CITY_SLUGS) expect(citySlugs.has(slug), slug).toBe(true);
  });

  it("builds product, occasion and district pages on SEO cities only", () => {
    for (const slug of PRODUCT_VILLE_PRIORITY_SLUGS) expect(citySlugs.has(slug), slug).toBe(true);
    for (const slug of OCCASION_VILLE_PRIORITY_SLUGS) expect(citySlugs.has(slug), slug).toBe(true);
    for (const district of SEO_DISTRICTS) {
      expect(citySlugs.has(district.citySlug), district.slug).toBe(true);
    }
  });
});
