// @vitest-environment node
//
// The sitemap's lastmod of a product x city or occasion x city page is the date that page shows
// (« Mis à jour le »), computed by the page's own content module: one authority per date. Until
// 2026-11-15 the sitemap had its own template constant, so a city text or an occasion text changed
// on another day than the template gave the sitemap and the page two different dates.
//
// The data below is the real data with such changes: every other city text dated after the
// template, every other occasion text dated before it.

import { describe, expect, it, vi } from "vitest";
import { SEO_CITIES } from "@/lib/seo/cities";
import { occasionCityContent } from "@/lib/seo/content/occasion-city";
import { productCityContent } from "@/lib/seo/content/product-city";
import { SEO_OCCASIONS } from "@/lib/seo/occasions";
import { SEO_PRODUCTS } from "@/lib/seo/products";
import { buildSitemapEntries, type SitemapEntry } from "@/lib/seo/sitemap-entries";

vi.mock("@/lib/seo/cities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/cities")>();
  return {
    ...actual,
    SEO_CITIES: actual.SEO_CITIES.map((city, index) =>
      index % 2 === 0 ? { ...city, lastUpdated: "2027-02-01" } : city
    ),
  };
});

vi.mock("@/lib/seo/occasions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo/occasions")>();
  return {
    ...actual,
    SEO_OCCASIONS: actual.SEO_OCCASIONS.map((occasion, index) =>
      index % 2 === 0 ? { ...occasion, lastUpdated: "2026-10-01" } : occasion
    ),
  };
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function find<T extends { slug: string }>(items: readonly T[], slug: string): T {
  const item = items.find((candidate) => candidate.slug === slug);
  if (item === undefined) throw new Error(`Unknown slug ${slug}`);
  return item;
}

// Every city has a listed shop, so every product x city page is in the sitemap.
const ENTRIES = buildSitemapEntries({
  shops: SEO_CITIES.map((city) => ({ city: city.name, listedAt: day("2026-01-01") })),
  recipes: [],
  latestProductUpdate: null,
});

function entriesOf(family: SitemapEntry["family"]): { entry: SitemapEntry; segments: string[] }[] {
  return ENTRIES.filter((entry) => entry.family === family).map((entry) => ({
    entry,
    segments: entry.path.split("/").filter(Boolean),
  }));
}

describe("sitemap lastmod = the date the page shows", () => {
  it("uses data whose dates differ from the templates", () => {
    expect(SEO_CITIES.some((city) => city.lastUpdated === "2027-02-01")).toBe(true);
    expect(SEO_OCCASIONS.some((occasion) => occasion.lastUpdated === "2026-10-01")).toBe(true);
  });

  it("product x city: every entry", () => {
    const products = entriesOf("product-city");
    expect(products.length).toBeGreaterThan(0);
    for (const { entry, segments } of products) {
      const [, productSlug, citySlug] = segments;
      const shown = productCityContent(
        find(SEO_PRODUCTS, productSlug),
        find(SEO_CITIES, citySlug),
        1
      ).lastUpdated;
      expect(entry.lastModified, entry.path).toEqual(day(shown));
    }
  });

  it("occasion x city: every entry", () => {
    const occasions = entriesOf("occasion-city");
    expect(occasions.length).toBeGreaterThan(0);
    for (const { entry, segments } of occasions) {
      const [, occasionSlug, citySlug] = segments;
      const shown = occasionCityContent(
        find(SEO_OCCASIONS, occasionSlug),
        find(SEO_CITIES, citySlug),
        1
      ).lastUpdated;
      expect(entry.lastModified, entry.path).toEqual(day(shown));
    }
  });
});
