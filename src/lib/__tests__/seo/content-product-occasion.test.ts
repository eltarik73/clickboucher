// @vitest-environment node
//
// Product x city and occasion x city pages (/produits/[produit]/[ville],
// /occasions/[occasion]/[ville]). Whatever the shops of the city (none or three), what the page
// says and marks up must stay true: no forbidden claim, no Event, Product or Offer markup, no
// « halal halal », no shop count, links and breadcrumbs only to pages that exist, an FAQ JSON-LD
// that repeats the visible FAQ, and page files that render the content modules and nothing else.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITY_CONTENT_UPDATED, SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { SEO_PRODUCTS, getProductCityCombinations } from "@/lib/seo/products";
import { SEO_OCCASIONS, getOccasionCityCombinations } from "@/lib/seo/occasions";
import { findForbiddenClaims } from "@/lib/seo/claims";
import {
  departmentOfCity,
  occasionCityBreadcrumb,
  productCityBreadcrumb,
} from "@/lib/seo/breadcrumbs";
import {
  cityPath,
  departmentPath,
  isClosedRoutePath,
  occasionCityPath,
  partnerPath,
  productCityPath,
} from "@/lib/seo/routes";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld/pages";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { absoluteUrl } from "@/lib/seo/site";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX } from "@/lib/seo/titles";
import { COMMON_FAQ } from "@/lib/seo/facts";
import {
  PRODUCT_CITY_CONTENT_UPDATED,
  productCityContent,
  productCityHead,
  productCityLastUpdated,
} from "@/lib/seo/content/product-city";
import {
  OCCASION_CITY_CONTENT_UPDATED,
  occasionCityContent,
  occasionCityHead,
  occasionCityLastUpdated,
} from "@/lib/seo/content/occasion-city";

const SHOP_COUNTS = [0, 3] as const;
// In the serialized JSON-LD: a forbidden type (or any value equal to one) and a forbidden key.
const FORBIDDEN_TYPE =
  /"(Event|FoodEvent|Product|AggregateOffer|Offer|Store|LocalBusiness|FoodEstablishment|AggregateRating|Review)"/;
const FORBIDDEN_KEY =
  /"(validFrom|organizer|offers|startDate|endDate|aggregateRating|review|speakable)":/;

function bySlug<T extends { slug: string }>(list: readonly T[], slug: string): T {
  const found = list.find((item) => item.slug === slug);
  if (found === undefined) throw new Error(`Unknown slug ${slug}`);
  return found;
}

function claimsIn(labelled: Record<string, string>): string[] {
  return Object.entries(labelled).flatMap(([label, text]) =>
    findForbiddenClaims(text).map((hit) => `${label}: [${hit.id}] « ${hit.match} »`)
  );
}

type CommonContent = ReturnType<typeof productCityContent> | ReturnType<typeof occasionCityContent>;

// Checks shared by both families: truthful text, allowed markup, existing links, no count.
function expectHonestPage(content: CommonContent, city: SeoCity, label: string) {
  const markup = content.jsonLd.map((data) => serializeJsonLd(data) ?? "").join("\n");
  const texts: Record<string, string> = {
    title: content.title,
    description: content.description,
    heading: content.heading,
    shopListHeading: content.shopListHeading,
    shopListText: content.shopListText,
    links: [content.cityLink, content.departmentLink, content.partnerLink]
      .map((link) => link.label)
      .join(" | "),
    faq: content.faqs.map((faq) => `${faq.question} ${faq.answer}`).join(" | "),
    jsonLd: markup,
  };
  expect(claimsIn(texts), label).toEqual([]);
  for (const text of [content.title, content.heading, content.description, markup]) {
    expect(text, label).not.toMatch(/halal\s+halal/i);
  }
  expect(content.title.length, label).toBeLessThanOrEqual(TITLE_MAX);
  expect(content.description.length, label).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
  expect(content.description.length, label).toBeLessThanOrEqual(DESCRIPTION_MAX);

  expect(markup.match(FORBIDDEN_TYPE)?.[0], label).toBeUndefined();
  expect(markup.match(FORBIDDEN_KEY)?.[0], label).toBeUndefined();
  expect(
    content.jsonLd.map((data) => data["@type"]),
    label
  ).toEqual(["WebPage", "BreadcrumbList", "FAQPage"]);
  expect(content.jsonLd[2], label).toEqual(faqPageJsonLd(content.faqs));

  expect(content.cityLink.path, label).toBe(cityPath(city.slug));
  expect(content.departmentLink.path, label).toBe(departmentPath(departmentOfCity(city.slug).slug));
  expect(content.partnerLink.path, label).toBe(partnerPath(city.slug));
  for (const link of [content.cityLink, content.departmentLink, ...content.otherCities]) {
    expect(isClosedRoutePath(link.path), `${label} → ${link.path}`).toBe(true);
  }
  expect(`${content.shopListHeading} ${content.shopListText}`, label).not.toMatch(/\d/);
}

function expectShopCountWording(empty: CommonContent, listed: CommonContent) {
  const answers = (content: CommonContent) => content.faqs.map((faq) => faq.answer).join(" ");
  expect(empty.shopListText).toMatch(/^Aucune boucherie halal/);
  expect(answers(empty)).toMatch(/Aucune boucherie halal/);
  expect(listed.shopListText).not.toMatch(/Aucune/);
  expect(answers(listed)).not.toMatch(/Aucune/);
}

describe("product x city content", () => {
  const combos = getProductCityCombinations().map((combo) => ({
    product: bySlug(SEO_PRODUCTS, combo.produit),
    city: bySlug(SEO_CITIES, combo.ville),
  }));

  for (const shopCount of SHOP_COUNTS) {
    it(`stays true and marks up a WebPage about the product, with ${shopCount} shop(s)`, () => {
      expect(combos).toHaveLength(SEO_PRODUCTS.length * 7);
      for (const { product, city } of combos) {
        const label = `${product.slug}/${city.slug} (${shopCount})`;
        const content = productCityContent(product, city, shopCount);
        expectHonestPage(content, city, label);
        expect(content.path, label).toBe(productCityPath(product.slug, city.slug));
        expect(content.jsonLd[0], label).toMatchObject({
          "@type": "WebPage",
          url: absoluteUrl(content.path),
          name: content.heading,
          description: content.description,
          about: { "@type": "Thing", name: product.name },
        });
        expect(content.jsonLd[1], label).toEqual(
          breadcrumbJsonLd(productCityBreadcrumb(product, city))
        );
        expect(claimsIn({ citySpecialty: content.citySpecialty }), label).toEqual([]);
        for (const link of content.otherProducts) expect(isClosedRoutePath(link.path)).toBe(true);
        expect(productCityHead(product, city)).toEqual({
          path: content.path,
          title: content.title,
          description: content.description,
        });
      }
    });
  }

  it("answers payment, fees and halal with the common facts, and words an empty city", () => {
    const product = bySlug(SEO_PRODUCTS, "kefta-halal");
    const city = bySlug(SEO_CITIES, "grenoble");
    const listed = productCityContent(product, city, 3);
    for (const faq of [COMMON_FAQ.payment, COMMON_FAQ.fees, COMMON_FAQ.halal]) {
      expect(listed.faqs).toContainEqual(faq);
    }
    expectShopCountWording(productCityContent(product, city, 0), listed);
    expect(listed.otherCities.map((link) => link.path)).not.toContain(listed.path);
    expect(listed.otherCities).toHaveLength(6);
  });

  it("dates the page with its latest text change, the city text included", () => {
    const city = bySlug(SEO_CITIES, "lyon");
    const cityDate = city.lastUpdated ?? CITY_CONTENT_UPDATED;
    expect(productCityLastUpdated(city)).toBe(
      cityDate > PRODUCT_CITY_CONTENT_UPDATED ? cityDate : PRODUCT_CITY_CONTENT_UPDATED
    );
    expect(productCityLastUpdated({ ...city, lastUpdated: "2099-01-01" })).toBe("2099-01-01");
  });

  it("refuses a shop count that is not a natural number", () => {
    const product = bySlug(SEO_PRODUCTS, "merguez-halal");
    const city = bySlug(SEO_CITIES, "lyon");
    expect(() => productCityContent(product, city, -1)).toThrow(RangeError);
    expect(() => productCityContent(product, city, 1.5)).toThrow(RangeError);
  });
});

describe("occasion x city content", () => {
  const combos = getOccasionCityCombinations().map((combo) => ({
    occasion: bySlug(SEO_OCCASIONS, combo.occasion),
    city: bySlug(SEO_CITIES, combo.ville),
  }));

  for (const shopCount of SHOP_COUNTS) {
    it(`stays true and marks up a WebPage about the occasion, with ${shopCount} shop(s)`, () => {
      expect(combos).toHaveLength(SEO_OCCASIONS.length * 8);
      for (const { occasion, city } of combos) {
        const label = `${occasion.slug}/${city.slug} (${shopCount})`;
        const content = occasionCityContent(occasion, city, shopCount);
        expectHonestPage(content, city, label);
        expect(content.path, label).toBe(occasionCityPath(occasion.slug, city.slug));
        expect(content.jsonLd[0], label).toMatchObject({
          "@type": "WebPage",
          url: absoluteUrl(content.path),
          name: content.heading,
          description: content.description,
          about: { "@type": "Thing", name: occasion.name },
        });
        expect(content.jsonLd[1], label).toEqual(
          breadcrumbJsonLd(occasionCityBreadcrumb(occasion, city))
        );
        for (const link of content.otherOccasions) expect(isClosedRoutePath(link.path)).toBe(true);
        expect(occasionCityHead(occasion, city)).toEqual({
          path: content.path,
          title: content.title,
          description: content.description,
        });
      }
    });
  }

  it("puts the serving tip, the booking delay and the common facts in the FAQ", () => {
    const occasion = bySlug(SEO_OCCASIONS, "aqiqa");
    const city = bySlug(SEO_CITIES, "saint-etienne");
    const listed = occasionCityContent(occasion, city, 3);
    expect(listed.faqs[0]).toEqual(occasion.servingTip);
    expect(listed.faqs.map((faq) => faq.answer)).toContain(occasion.bookingDelay);
    for (const faq of [COMMON_FAQ.payment, COMMON_FAQ.fees, COMMON_FAQ.halal]) {
      expect(listed.faqs).toContainEqual(faq);
    }
    expectShopCountWording(occasionCityContent(occasion, city, 0), listed);
  });

  it("dates the page with the later of the occasion text and the template", () => {
    const ramadan = bySlug(SEO_OCCASIONS, "ramadan");
    expect(occasionCityLastUpdated({ ...ramadan, lastUpdated: "2099-01-01" })).toBe("2099-01-01");
    expect(occasionCityLastUpdated({ ...ramadan, lastUpdated: "2020-01-01" })).toBe(
      OCCASION_CITY_CONTENT_UPDATED
    );
    const buffet = bySlug(SEO_OCCASIONS, "buffet");
    expect(() => occasionCityContent(buffet, bySlug(SEO_CITIES, "lyon"), -2)).toThrow(RangeError);
  });
});

describe("occasion data (no event markup)", () => {
  it("carries only editorial fields: no event type, event date or meta keyword", () => {
    const allowed = new Set(
      "slug name shortDescription intro servingTip bookingDelay season priority lastUpdated".split(
        " "
      )
    );
    for (const occasion of SEO_OCCASIONS) {
      expect(
        Object.keys(occasion).filter((key) => !allowed.has(key)),
        occasion.slug
      ).toEqual([]);
    }
  });

  it("keeps the expected 2027 dates of the Aïd and of Ramadan in the visible text", () => {
    expect(bySlug(SEO_OCCASIONS, "aid-al-adha").intro).toMatch(/2027.*16 mai/);
    expect(bySlug(SEO_OCCASIONS, "ramadan").intro).toMatch(/2027.*8 février/);
  });

  it("renders data texts free of forbidden claims", () => {
    const texts: Record<string, string> = {};
    for (const o of SEO_OCCASIONS) {
      texts[o.slug] = [o.shortDescription, o.intro, o.bookingDelay, o.servingTip.answer].join(" ");
    }
    for (const p of SEO_PRODUCTS) {
      texts[p.slug] = [p.shortDescription, p.intro, p.cookingTips, p.servingQuestion?.answer]
        .filter((text) => text !== undefined)
        .join(" ");
    }
    expect(claimsIn(texts)).toEqual([]);
  });
});

// Hidden text, inline JSON-LD, a breadcrumb built by hand, a clock in the render, meta keywords.
const BANNED_IN_PAGES =
  /sr-only|data-purpose|"@type":|BreadcrumbSchema|new Date\(|Date\.now\(|keywords:/;

describe("page sources", () => {
  const app = join(__dirname, "..", "..", "..", "app");
  const pages = {
    produits: readFileSync(join(app, "produits", "[produit]", "[ville]", "page.tsx"), "utf-8"),
    occasions: readFileSync(join(app, "occasions", "[occasion]", "[ville]", "page.tsx"), "utf-8"),
  };

  for (const [name, source] of Object.entries(pages)) {
    it(`${name}: closed list, JSON-LD from the content module only, no hidden text`, () => {
      expect(source.match(/export const dynamicParams = false;/g)).toHaveLength(1);
      expect(source).toContain("content.jsonLd.map(");
      expect(source.match(BANNED_IN_PAGES)?.[0]).toBeUndefined();
      expect(source.match(/<Link\b/g)?.length).toBe(source.match(/prefetch=\{false\}/g)?.length);
    });
  }

  it("keeps the shop-count noindex of the product pages and none on the occasion pages", () => {
    expect(pages.produits).toContain("const shouldNoIndex = shopCount === 0;");
    expect(pages.produits).toContain(
      "...(shouldNoIndex && { robots: { index: false, follow: true } }),"
    );
    expect(pages.occasions).not.toMatch(/robots/);
  });
});
