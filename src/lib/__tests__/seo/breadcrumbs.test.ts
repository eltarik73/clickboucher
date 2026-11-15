// @vitest-environment node
//
// Breadcrumbs never link to a 404 (Search Console listed /produits and /occasions/aid-al-adha,
// both reached through breadcrumbs) and follow home > department > city > page.

import { describe, it, expect } from "vitest";
import {
  cityBreadcrumb,
  departmentBreadcrumb,
  departmentOfCity,
  districtBreadcrumb,
  occasionCityBreadcrumb,
  partnerBreadcrumb,
  productCityBreadcrumb,
  regionalHubBreadcrumb,
  shopBreadcrumb,
  sundayBreadcrumb,
  type Crumb,
} from "@/lib/seo/breadcrumbs";
import { seoCitySlugsForShopCity } from "@/lib/seo/city-match";
import { closedRoutePaths } from "@/lib/seo/routes";
import { SITE_URL } from "@/lib/seo/site";
import { SEO_CITIES, SEO_DEPARTMENTS, type SeoCity } from "@/lib/seo/cities";
import { getDistrictsByCity, SEO_DISTRICTS } from "@/lib/seo/districts";
import { SEO_PRODUCTS } from "@/lib/seo/products";
import { SEO_OCCASIONS } from "@/lib/seo/occasions";

const closed = new Set(closedRoutePaths());

function city(slug: string): SeoCity {
  const found = SEO_CITIES.find((c) => c.slug === slug);
  if (!found) throw new Error(`test setup: unknown city ${slug}`);
  return found;
}

function pathOf(url: string): string {
  expect(url.startsWith(SITE_URL)).toBe(true);
  return url === SITE_URL ? "/" : url.slice(SITE_URL.length);
}

function cityBasedTrails(c: SeoCity): Record<string, Crumb[]> {
  const district = getDistrictsByCity(c.slug)[0];
  return {
    city: cityBreadcrumb(c),
    district: districtBreadcrumb(c, district),
    sunday: sundayBreadcrumb(c),
    product: productCityBreadcrumb(SEO_PRODUCTS[0], c),
    occasion: occasionCityBreadcrumb(SEO_OCCASIONS[0], c),
    partner: partnerBreadcrumb(c),
  };
}

describe.each(["chambery", "lyon", "saint-etienne"])("trails of %s", (slug) => {
  const trails = cityBasedTrails(city(slug));

  it("links every crumb of the six city-based builders to an existing page", () => {
    for (const [family, trail] of Object.entries(trails)) {
      for (const crumb of trail) {
        expect(closed.has(pathOf(crumb.url)), `${family}: ${crumb.url}`).toBe(true);
      }
    }
  });

  it("goes home > department > city > page", () => {
    const department = departmentOfCity(slug);
    for (const family of ["city", "district", "sunday", "product", "occasion"]) {
      const trail = trails[family];
      expect(trail[0]).toEqual({ name: "Accueil", url: SITE_URL });
      expect(trail[1]).toEqual({
        name: `Boucheries halal ${department.name}`,
        url: `${SITE_URL}/boucheries-halal/${department.slug}`,
      });
      expect(trail[2]).toEqual({
        name: city(slug).name,
        url: `${SITE_URL}/boucherie-halal/${slug}`,
      });
    }
    expect(trails.city).toHaveLength(3);
    expect(trails.sunday.at(-1)?.url).toBe(
      `${SITE_URL}/boucheries-halal-ouvertes-dimanche/${slug}`
    );
  });

  it("puts the partner page under the butcher space, not under the customer city page", () => {
    expect(trails.partner.map((crumb) => pathOf(crumb.url))).toEqual([
      "/",
      "/espace-boucher",
      `/devenir-boucher-partenaire/${slug}`,
    ]);
  });
});

describe("every city of the data", () => {
  it("has a partner trail of existing pages", () => {
    for (const c of SEO_CITIES) {
      for (const crumb of partnerBreadcrumb(c)) expect(closed.has(pathOf(crumb.url))).toBe(true);
    }
  });

  it("has a city trail of existing pages when it belongs to a department", () => {
    const inDepartment = SEO_CITIES.filter((c) =>
      SEO_DEPARTMENTS.some((dept) => dept.citySlugs.includes(c.slug))
    );
    expect(inDepartment.length).toBeGreaterThan(0);
    for (const c of inDepartment) {
      for (const crumb of cityBreadcrumb(c)) expect(closed.has(pathOf(crumb.url))).toBe(true);
    }
  });
});

describe("departmentBreadcrumb", () => {
  it("goes home > regional hub > department for every department", () => {
    for (const dept of SEO_DEPARTMENTS) {
      expect(departmentBreadcrumb(dept).map((crumb) => pathOf(crumb.url))).toEqual([
        "/",
        "/boucheries-halal-rhone-alpes",
        `/boucheries-halal/${dept.slug}`,
      ]);
    }
  });
});

describe("departmentOfCity", () => {
  it("finds the department of a city", () => {
    expect(departmentOfCity("chambery").slug).toBe("savoie");
    expect(departmentOfCity("lyon").slug).toBe("rhone");
  });

  it("throws, naming the slug, when the city belongs to no department", () => {
    expect(() => departmentOfCity("nowhere")).toThrow(/nowhere/);
  });
});

describe("refusals instead of a link to a 404", () => {
  it("refuses a product or occasion page that does not exist for the city", () => {
    const bissy = city("bissy");
    expect(() => productCityBreadcrumb(SEO_PRODUCTS[0], bissy)).toThrow(/does not exist/);
    expect(() => occasionCityBreadcrumb(SEO_OCCASIONS[0], bissy)).toThrow(/does not exist/);
  });

  it("refuses a district of another city", () => {
    const lyonDistrict = SEO_DISTRICTS.find((district) => district.citySlug === "lyon");
    expect(lyonDistrict).toBeDefined();
    expect(() => districtBreadcrumb(city("chambery"), lyonDistrict!)).toThrow(/lyon/);
  });
});

describe("shopBreadcrumb", () => {
  it("places a shop of a SEO city under its department and city", () => {
    const trail = shopBreadcrumb({
      name: "Boucherie Test",
      slug: "boucherie-test",
      city: "Chambéry",
    });
    expect(trail.map((crumb) => crumb.name)).toEqual([
      "Accueil",
      "Boucheries halal Savoie",
      "Chambéry",
      "Boucherie Test",
    ]);
    expect(trail.at(-1)?.url).toBe(`${SITE_URL}/boutique/boucherie-test`);
  });

  it("matches the shop city case-insensitively, as the sitemap does", () => {
    const trail = shopBreadcrumb({ name: "B", slug: "b", city: "  LYON 7e " });
    expect(trail.map((crumb) => pathOf(crumb.url))).toEqual([
      "/",
      "/boucheries-halal/rhone",
      "/boucherie-halal/lyon",
      "/boutique/b",
    ]);
  });

  it("goes straight from home to the shop when its city is not a SEO city", () => {
    for (const shopCity of ["Marseille", null, ""]) {
      expect(
        shopBreadcrumb({ name: "B", slug: "b", city: shopCity }).map((crumb) => pathOf(crumb.url))
      ).toEqual(["/", "/boutique/b"]);
    }
  });

  it("names the city the sitemap and IndexNow match (seoCitySlugsForShopCity)", () => {
    for (const shopCity of ["Lyon / Villeurbanne", "Saint-Martin-d'Hères", "Aix-les-Bains"]) {
      const [slug] = seoCitySlugsForShopCity(shopCity);
      const trail = shopBreadcrumb({ name: "B", slug: "b", city: shopCity });
      expect(pathOf(trail[2].url), shopCity).toBe(`/boucherie-halal/${slug}`);
    }
  });
});

describe("regionalHubBreadcrumb", () => {
  it("goes home > regional hub", () => {
    expect(regionalHubBreadcrumb().map((crumb) => pathOf(crumb.url))).toEqual([
      "/",
      "/boucheries-halal-rhone-alpes",
    ]);
    expect(departmentBreadcrumb(SEO_DEPARTMENTS[0]).slice(0, 2)).toEqual(regionalHubBreadcrumb());
  });
});
