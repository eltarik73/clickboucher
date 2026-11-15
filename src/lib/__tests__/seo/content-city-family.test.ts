// @vitest-environment node
//
// Content of the city-family pages (ville, quartier, département, hub régional, dimanche):
// every sentence, title, description and JSON-LD block is free of forbidden claims for every
// page of the data, with zero shop and with shops; the JSON-LD describes pages only (no shop
// entity, no rating, no event, no product, no speakable); the FAQ answers on fees, payment and
// halal are the shared facts; lists link to our own city pages only.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { SEO_CITIES, SEO_DEPARTMENTS, type SeoCity } from "@/lib/seo/cities";
import { SEO_DISTRICTS, type SeoDistrict } from "@/lib/seo/districts";
import { COMMON_FAQ, type Faq } from "@/lib/seo/facts";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import type { JsonLdObject } from "@/lib/seo/jsonld/pages";
import { departmentBreadcrumb } from "@/lib/seo/breadcrumbs";
import { SITE_URL } from "@/lib/seo/site";
import {
  REGIONAL_HUB_PATH,
  cityPath,
  departmentPath,
  isClosedRoutePath,
  sundayPath,
} from "@/lib/seo/routes";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";
import * as titles from "@/lib/seo/titles";
import { cityPageContent, shopCountLabel } from "@/lib/seo/content/city";
import { districtPageContent, type DistrictListing } from "@/lib/seo/content/district";
import { departmentPageContent } from "@/lib/seo/content/department";
import * as hub from "@/lib/seo/content/regional-hub";
import { findSundayCity, sundayPageContent } from "@/lib/seo/content/sunday";

const SHOP_COUNTS = [0, 1, 3] as const;
const FORBIDDEN_TYPES = new Set(
  "Store LocalBusiness FoodEstablishment Event FoodEvent Product Offer AggregateOffer AggregateRating Review SpeakableSpecification".split(
    " "
  )
);
const FORBIDDEN_KEYS = new Set(["aggregateRating", "review", "speakable"]);

type Content = { faqs: Faq[]; jsonLd: JsonLdObject[] };

function bySlug<T extends { slug: string }>(list: readonly T[], slug: string): T {
  const found = list.find((item) => item.slug === slug);
  if (!found) throw new Error(`test setup: unknown slug ${slug}`);
  return found;
}
const city = (slug: string): SeoCity => bySlug(SEO_CITIES, slug);
const district = (slug: string): SeoDistrict => bySlug(SEO_DISTRICTS, slug);

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value === null || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
}

/** Every (key, value) pair of every object found anywhere in the value. */
function entriesIn(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) return value.flatMap(entriesIn);
  if (value === null || typeof value !== "object") return [];
  const own = Object.entries(value as Record<string, unknown>);
  return [...own, ...own.flatMap(([, child]) => entriesIn(child))];
}

function block(jsonLd: JsonLdObject[], type: string): JsonLdObject {
  const blocks = jsonLd.filter((b) => b["@type"] === type);
  expect(blocks, type).toHaveLength(1);
  return blocks[0];
}

/** One field of every item of an itemListElement. */
function field(items: unknown, key: "name" | "url" | "item"): string[] {
  return (items as Record<string, string>[]).map((item) => item[key]);
}
const crumbNames = (jsonLd: JsonLdObject[]) =>
  field(block(jsonLd, "BreadcrumbList").itemListElement, "name");
const listUrls = (page: JsonLdObject) =>
  field((page.mainEntity as JsonLdObject).itemListElement, "url");

/**
 * The checks every page of the family must pass: no forbidden claim in any string nor in the
 * serialized JSON-LD, page-only JSON-LD whose URLs are pages of the closed registry, an
 * FAQPage identical to the visible FAQ, and the shared answers on fees, payment and halal.
 */
function expectCleanContent(content: Content, extraTexts: string[] = []): void {
  const serialized = content.jsonLd.map((b) => serializeJsonLd(b) ?? "").join("\n");
  const texts = [...stringsIn(content), ...extraTexts, JSON.stringify(content.jsonLd), serialized];
  expect(texts.flatMap(findForbiddenClaims)).toEqual([]);

  const entries = entriesIn(content.jsonLd);
  const types = entries.filter(([key]) => key === "@type").flatMap(([, type]) => [type].flat());
  expect(types.filter((type) => FORBIDDEN_TYPES.has(String(type)))).toEqual([]);
  expect(entries.filter(([key]) => FORBIDDEN_KEYS.has(key))).toEqual([]);
  for (const [key, url] of entries) {
    if ((key !== "url" && key !== "item") || typeof url !== "string") continue;
    expect(url.startsWith(SITE_URL), url).toBe(true);
    expect(isClosedRoutePath(url === SITE_URL ? "/" : url.slice(SITE_URL.length)), url).toBe(true);
  }

  const questions = block(content.jsonLd, "FAQPage").mainEntity as {
    name: string;
    acceptedAnswer: { text: string };
  }[];
  expect(questions.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
    content.faqs.map((faq) => [faq.question, faq.answer])
  );
  for (const fact of [COMMON_FAQ.fees, COMMON_FAQ.payment, COMMON_FAQ.halal]) {
    expect(content.faqs).toContainEqual(fact);
  }
}

describe("city page content (/boucherie-halal/[ville])", () => {
  it.each(SEO_CITIES.map((c) => [c.slug, c] as const))("%s, 0 to 3 shops", (_slug, seoCity) => {
    for (const count of SHOP_COUNTS) {
      expectCleanContent(cityPageContent(seoCity, count), [
        titles.cityTitle(seoCity),
        seoCity.description,
      ]);
    }
  });

  it("is a WebPage about the city, under its department, linking to both hubs", () => {
    const content = cityPageContent(city("chambery"), 0);
    expect(crumbNames(content.jsonLd)).toEqual(["Accueil", "Boucheries halal Savoie", "Chambéry"]);
    expect(block(content.jsonLd, "WebPage").url).toBe(`${SITE_URL}${cityPath("chambery")}`);
    expect(block(content.jsonLd, "WebPage").about).toEqual({ "@type": "Place", name: "Chambéry" });
    expect(content.departmentLink.label).toBe("Boucheries halal en Savoie");
    expect(content.departmentLink.path).toBe(departmentPath("savoie"));
    expect(content.regionalHubLink.path).toBe(REGIONAL_HUB_PATH);
    const lyon = cityPageContent(city("lyon"), 0).departmentLink;
    expect([lyon.label, lyon.path]).toEqual([
      "Boucheries halal dans le Rhône",
      "/boucheries-halal/rhone",
    ]);
  });

  it("states the number of listed shops only when there are some", () => {
    const empty = cityPageContent(city("lyon"), 0);
    expect(stringsIn(empty.faqs).join(" ")).not.toMatch(/\d+ boucheries?/);
    expect(empty.emptyText).toContain("Lyon");
    expect(stringsIn(cityPageContent(city("lyon"), 3).faqs).join(" ")).toContain(
      "3 boucheries halal de Lyon"
    );
    expect([0, 1, 12].map(shopCountLabel)).toEqual([
      "Aucune boucherie inscrite",
      "1 boucherie inscrite",
      "12 boucheries inscrites",
    ]);
  });
});

describe("district page content (/boucherie-halal/[ville]/[quartier])", () => {
  const listings: DistrictListing[] = [
    { shown: 0, inDistrict: false },
    { shown: 3, inDistrict: false },
    { shown: 3, inDistrict: true },
  ];

  it.each(SEO_DISTRICTS.map((d) => [`${d.citySlug}/${d.slug}`, d] as const))(
    "%s, every kind of listing",
    (_path, seoDistrict) => {
      for (const listing of listings) {
        expectCleanContent(districtPageContent(city(seoDistrict.citySlug), seoDistrict, listing), [
          titles.districtTitle(seoDistrict),
          seoDistrict.description,
        ]);
      }
    }
  );

  it("is a WebPage about the district, and never presents city-wide shops as its own", () => {
    const vaise = district("vaise");
    const fallback = districtPageContent(city("lyon"), vaise, { shown: 3, inDistrict: false });
    const about = { "@type": "Place", name: "Vaise, Lyon" };
    expect(block(fallback.jsonLd, "WebPage").about).toEqual(about);
    expect(crumbNames(fallback.jsonLd)).toEqual([
      "Accueil",
      "Boucheries halal Rhône",
      "Lyon",
      "Vaise",
    ]);
    expect(fallback.listHeading).toBe("Boucheries halal à Lyon sur Klik&Go");
    expect(fallback.listIntro).toContain("Aucune boucherie inscrite sur Klik&Go n'a encore");
    const precise = districtPageContent(city("lyon"), vaise, { shown: 3, inDistrict: true });
    expect(precise.listHeading).toBe("Boucheries halal à Vaise sur Klik&Go");
  });
});

describe("department page content (/boucheries-halal/[departement])", () => {
  it.each(SEO_DEPARTMENTS.map((d) => [d.slug, d] as const))(
    "%s: a CollectionPage of exactly its city pages",
    (slug, dept) => {
      for (const count of SHOP_COUNTS) {
        const content = departmentPageContent(dept, count);
        expectCleanContent(content, [titles.departmentTitle(dept), dept.description]);
        const collection = block(content.jsonLd, "CollectionPage");
        expect(collection.url).toBe(`${SITE_URL}${departmentPath(slug)}`);
        expect(listUrls(collection)).toEqual(
          dept.citySlugs.map((citySlug) => `${SITE_URL}${cityPath(citySlug)}`)
        );
        expect(content.cities.map((c) => c.slug)).toEqual([...dept.citySlugs]);
      }
    }
  );
});

describe("regional hub content (/boucheries-halal-rhone-alpes)", () => {
  it("has a title and a description within the display limits, naming what they count", () => {
    expect(hub.REGIONAL_HUB_TITLE.length).toBeLessThanOrEqual(titles.TITLE_MAX);
    expect(hub.REGIONAL_HUB_DESCRIPTION.length).toBeGreaterThanOrEqual(titles.DESCRIPTION_MIN);
    expect(hub.REGIONAL_HUB_DESCRIPTION.length).toBeLessThanOrEqual(titles.DESCRIPTION_MAX);
    expect(hub.REGIONAL_HUB_DESCRIPTION).toContain(`${SEO_CITIES.length} villes`);
    for (const dept of SEO_DEPARTMENTS) expect(hub.REGIONAL_HUB_DESCRIPTION).toContain(dept.name);
  });

  it.each(SHOP_COUNTS.map((count) => [count]))("with %i listed shops", (count) => {
    const content = hub.regionalHubContent(count);
    expectCleanContent(content, [hub.REGIONAL_HUB_TITLE, hub.REGIONAL_HUB_DESCRIPTION]);
    expect(content.faqs).toContainEqual(COMMON_FAQ.delivery);
    expect(listUrls(block(content.jsonLd, "CollectionPage"))).toEqual(
      content.featuredCities.map((c) => `${SITE_URL}${cityPath(c.slug)}`)
    );
  });

  it("uses the regional crumb of the department trails and lists every department", () => {
    const content = hub.regionalHubContent(0);
    const hubTrail = departmentBreadcrumb(SEO_DEPARTMENTS[0]).slice(0, 2);
    const items = block(content.jsonLd, "BreadcrumbList").itemListElement;
    expect(field(items, "name")).toEqual(hubTrail.map((crumb) => crumb.name));
    expect(field(items, "item")).toEqual(hubTrail.map((crumb) => crumb.url));
    expect(content.departments.map((d) => d.department.slug)).toEqual(
      SEO_DEPARTMENTS.map((d) => d.slug)
    );
    expect(content.featuredCities[0].slug).toBe("chambery");
  });
});

describe("Sunday page content (/boucheries-halal-ouvertes-dimanche/[ville])", () => {
  it.each(SUNDAY_CITY_SLUGS.map((slug) => [slug]))(
    "%s: a CollectionPage without shop item",
    (slug) => {
      const seoCity = findSundayCity(slug);
      if (!seoCity) throw new Error(`Sunday city ${slug} is not a SEO city`);
      for (const count of SHOP_COUNTS) {
        const content = sundayPageContent(seoCity, count);
        expectCleanContent(content, [
          titles.sundayTitle(seoCity),
          titles.sundayDescription(seoCity),
        ]);
        const collection = block(content.jsonLd, "CollectionPage");
        expect(collection.url).toBe(`${SITE_URL}${sundayPath(slug)}`);
        expect(collection).not.toHaveProperty("mainEntity");
        expect(content.otherCities.map((c) => c.slug)).toEqual(
          SUNDAY_CITY_SLUGS.filter((other) => other !== slug)
        );
      }
    }
  );

  it("only knows the cities of the Sunday list", () => {
    expect(findSundayCity("chambery")?.name).toBe("Chambéry");
    expect(findSundayCity("bassens")).toBeUndefined();
    expect(findSundayCity("ville-inconnue")).toBeUndefined();
  });
});

describe("page sources of the city family", () => {
  const root = join(__dirname, "..", "..", "..", "app");
  const dynamicPages = [
    "boucherie-halal/[ville]/page.tsx",
    "boucherie-halal/[ville]/[quartier]/page.tsx",
    "boucheries-halal/[departement]/page.tsx",
    "boucheries-halal-ouvertes-dimanche/[ville]/page.tsx",
  ];
  const source = (file: string) => readFileSync(join(root, file), "utf8");

  it.each([...dynamicPages, "boucheries-halal-rhone-alpes/page.tsx"].map((file) => [file]))(
    "%s renders no shop schema, speakable, hidden text or rating",
    (file) => {
      expect(source(file)).not.toMatch(/ShopSchema|SpeakableSchema|sr-only|aggregateRating/);
    }
  );

  it.each(dynamicPages.map((file) => [file]))("%s answers 404 outside its closed list", (file) => {
    expect(source(file).match(/export const dynamicParams = false;/g)).toHaveLength(1);
  });

  it("takes the Sunday cities from the one Sunday list", () => {
    const sunday = source("boucheries-halal-ouvertes-dimanche/[ville]/page.tsx");
    expect(sunday).toContain("SUNDAY_CITY_SLUGS");
    expect(sunday).not.toContain("ELIGIBLE_CITIES");
  });
});
