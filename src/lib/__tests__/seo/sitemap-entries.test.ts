// @vitest-environment node
//
// The sitemap builder: the URL set submitted to search engines and its lastmod. No shop page is
// ever listed; cities, partner pages, departments, the regional hub and occasions always are; the
// long-tail families (Sunday, product x city, district) only for cities with a listed shop; each
// lastmod is the day that page's content really changed.

import { describe, expect, it } from "vitest";
import { CITY_CONTENT_UPDATED, SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { getCityDistrictCombinations } from "@/lib/seo/districts";
import { SEO_OCCASIONS, getOccasionCityCombinations } from "@/lib/seo/occasions";
import { getProductCityCombinations } from "@/lib/seo/products";
import { REGIONAL_HUB_PATH, STATIC_PUBLIC_PATHS, closedRoutePaths } from "@/lib/seo/routes";
import {
  DEPARTMENT_CONTENT_UPDATED,
  PARTNER_CONTENT_UPDATED,
  PRODUCT_CITY_CONTENT_UPDATED,
  STATIC_PAGES,
  buildSitemapEntries,
  entriesChangedSince,
  type SitemapData,
  type SitemapEntry,
} from "@/lib/seo/sitemap-entries";

const EMPTY: SitemapData = { shops: [], recipes: [], latestProductUpdate: null };
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function entryAt(entries: SitemapEntry[], path: string): SitemapEntry {
  const entry = entries.find((candidate) => candidate.path === path);
  if (entry === undefined) throw new Error(`No sitemap entry for ${path}`);
  return entry;
}

const paths = (entries: SitemapEntry[]) => entries.map((entry) => entry.path);

describe("buildSitemapEntries: URL set", () => {
  it("never lists a shop page, even with listed shops everywhere", () => {
    const data: SitemapData = {
      ...EMPTY,
      shops: SEO_CITIES.map((city) => ({ city: city.name, listedAt: day("2027-01-01") })),
    };
    expect(paths(buildSitemapEntries(data)).filter((path) => path.startsWith("/boutique"))).toEqual(
      []
    );
  });

  it("always lists every city page and every partner page, even without any shop", () => {
    const entries = buildSitemapEntries(EMPTY);
    const cityPages = paths(entries).filter((path) => /^\/boucherie-halal\/[^/]+$/.test(path));
    const partnerPages = paths(entries).filter((path) =>
      /^\/devenir-boucher-partenaire\/[^/]+$/.test(path)
    );
    expect(cityPages).toHaveLength(SEO_CITIES.length);
    expect(partnerPages).toHaveLength(SEO_CITIES.length);
    for (const city of SEO_CITIES) {
      expect(cityPages).toContain(`/boucherie-halal/${city.slug}`);
      expect(partnerPages).toContain(`/devenir-boucher-partenaire/${city.slug}`);
    }
  });

  it("always lists the departments, the regional hub, every occasion x city and the static pages", () => {
    const listed = paths(buildSitemapEntries(EMPTY));
    expect(SEO_DEPARTMENTS).toHaveLength(5);
    for (const dept of SEO_DEPARTMENTS) expect(listed).toContain(`/boucheries-halal/${dept.slug}`);
    expect(listed).toContain(REGIONAL_HUB_PATH);
    for (const combo of getOccasionCityCombinations()) {
      expect(listed).toContain(`/occasions/${combo.occasion}/${combo.ville}`);
    }
    expect(
      buildSitemapEntries(EMPTY)
        .filter((entry) => entry.family === "static")
        .map((entry) => entry.path)
    ).toEqual([...STATIC_PUBLIC_PATHS]);
  });

  it("lists the Sunday, product and district pages only for cities with a listed shop", () => {
    const withoutShop = paths(buildSitemapEntries(EMPTY));
    expect(
      withoutShop.filter((path) => path.startsWith("/boucheries-halal-ouvertes-dimanche/"))
    ).toEqual([]);
    expect(withoutShop.filter((path) => path.startsWith("/produits/"))).toEqual([]);
    expect(withoutShop.filter((path) => /^\/boucherie-halal\/[^/]+\/[^/]+$/.test(path))).toEqual(
      []
    );

    const listed = paths(
      buildSitemapEntries({ ...EMPTY, shops: [{ city: "Lyon 7e", listedAt: day("2027-01-01") }] })
    );
    expect(listed).toContain("/boucheries-halal-ouvertes-dimanche/lyon");
    expect(listed).not.toContain("/boucheries-halal-ouvertes-dimanche/grenoble");
    const lyonProducts = getProductCityCombinations().filter((combo) => combo.ville === "lyon");
    expect(lyonProducts.length).toBeGreaterThan(0);
    for (const combo of lyonProducts) expect(listed).toContain(`/produits/${combo.produit}/lyon`);
    expect(listed.filter((path) => path.startsWith("/produits/"))).toHaveLength(
      lyonProducts.length
    );
    const lyonDistricts = getCityDistrictCombinations().filter((combo) => combo.ville === "lyon");
    expect(lyonDistricts.length).toBeGreaterThan(0);
    expect(listed.filter((path) => /^\/boucherie-halal\/[^/]+\/[^/]+$/.test(path))).toEqual(
      lyonDistricts.map((combo) => `/boucherie-halal/lyon/${combo.quartier}`)
    );
  });

  it("lists one page per indexable recipe given", () => {
    const listed = paths(
      buildSitemapEntries({
        ...EMPTY,
        recipes: [{ slug: "tajine-agneau", updatedAt: day("2027-01-01") }],
      })
    );
    expect(listed).toContain("/recettes/tajine-agneau");
  });

  it("lists each page once, and every page but recipes exists in the closed route registry", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      shops: SEO_CITIES.map((city) => ({ city: city.name, listedAt: day("2027-01-01") })),
    });
    expect(new Set(paths(entries)).size).toBe(entries.length);
    const registry = new Set(closedRoutePaths());
    for (const entry of entries.filter((candidate) => candidate.family !== "recipe")) {
      expect(registry.has(entry.path), entry.path).toBe(true);
    }
  });

  it("throws rather than list a URL the submission policy refuses", () => {
    expect(() =>
      buildSitemapEntries({ ...EMPTY, recipes: [{ slug: "", updatedAt: day("2027-01-01") }] })
    ).toThrow(/submission policy/);
  });
});

describe("buildSitemapEntries: lastModified", () => {
  const chamberyShops: SitemapData = {
    ...EMPTY,
    shops: [
      { city: "Chambéry", listedAt: day("2027-02-01") },
      { city: "CHAMBÉRY ", listedAt: new Date("2027-03-10T14:30:00.000Z") },
    ],
  };

  it("dates a city page by its newest listed shop, and leaves the other cities at their content date", () => {
    const entries = buildSitemapEntries(chamberyShops);
    expect(entryAt(entries, "/boucherie-halal/chambery").lastModified).toEqual(
      new Date("2027-03-10T14:30:00.000Z")
    );
    expect(entryAt(entries, "/boucherie-halal/lyon").lastModified).toEqual(
      day(CITY_CONTENT_UPDATED)
    );
  });

  it("keeps the content date of a city when its shops were listed before the text changed", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      shops: [{ city: "Chambéry", listedAt: day("2025-01-01") }],
    });
    expect(entryAt(entries, "/boucherie-halal/chambery").lastModified).toEqual(
      day(CITY_CONTENT_UPDATED)
    );
  });

  it("dates the home page by the newest listed shop of any city", () => {
    const entries = buildSitemapEntries({
      ...chamberyShops,
      shops: [...chamberyShops.shops, { city: "Marseille", listedAt: day("2027-04-01") }],
    });
    expect(entryAt(entries, "/").lastModified).toEqual(day("2027-04-01"));
  });

  it("dates /bons-plans by the newest product update and /recettes by the newest recipe", () => {
    const entries = buildSitemapEntries({
      shops: [],
      recipes: [
        { slug: "a", updatedAt: day("2027-05-01") },
        { slug: "b", updatedAt: day("2027-06-01") },
      ],
      latestProductUpdate: day("2027-07-01"),
    });
    expect(entryAt(entries, "/bons-plans").lastModified).toEqual(day("2027-07-01"));
    expect(entryAt(entries, "/recettes").lastModified).toEqual(day("2027-06-01"));
    expect(entryAt(entries, "/recettes/a").lastModified).toEqual(day("2027-05-01"));
  });

  it("dates every static page by its own content date when no data is newer", () => {
    const entries = buildSitemapEntries(EMPTY);
    for (const path of STATIC_PUBLIC_PATHS) {
      expect(entryAt(entries, path).lastModified, path).toEqual(
        day(STATIC_PAGES.get(path)?.contentUpdated ?? "missing")
      );
    }
    expect(entryAt(entries, "/cgv").lastModified).toEqual(day("2026-01-01"));
  });

  it("dates the template families by their content date and occasions by their own date", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      shops: [{ city: "Lyon", listedAt: day("2027-01-01") }],
    });
    expect(entryAt(entries, "/boucheries-halal/savoie").lastModified).toEqual(
      day(DEPARTMENT_CONTENT_UPDATED)
    );
    expect(entryAt(entries, "/devenir-boucher-partenaire/lyon").lastModified).toEqual(
      day(PARTNER_CONTENT_UPDATED)
    );
    const [product] = getProductCityCombinations();
    expect(entryAt(entries, `/produits/${product.produit}/lyon`).lastModified).toEqual(
      day(PRODUCT_CITY_CONTENT_UPDATED)
    );
    for (const occasion of SEO_OCCASIONS) {
      expect(entryAt(entries, `/occasions/${occasion.slug}/lyon`).lastModified).toEqual(
        day(occasion.lastUpdated ?? "missing")
      );
    }
  });
});

describe("buildSitemapEntries: crawl hints", () => {
  it("marks /recettes weekly", () => {
    expect(entryAt(buildSitemapEntries(EMPTY), "/recettes").changeFrequency).toBe("weekly");
  });

  it("has one static page description per static public path", () => {
    expect([...STATIC_PAGES.keys()].sort()).toEqual([...STATIC_PUBLIC_PATHS].sort());
  });
});

describe("entriesChangedSince", () => {
  it("keeps the entries modified at or after the given instant", () => {
    const since = new Date("2027-03-10T00:00:00.000Z");
    const entries = buildSitemapEntries({
      ...EMPTY,
      shops: [
        { city: "Chambéry", listedAt: since },
        { city: "Lyon", listedAt: new Date(since.getTime() - 1) },
      ],
    });
    expect(paths(entriesChangedSince(entries, since))).toEqual(["/", "/boucherie-halal/chambery"]);
  });
});
