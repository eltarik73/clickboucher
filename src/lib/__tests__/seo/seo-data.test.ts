// @vitest-environment node
//
// Guards on the editorial data behind the occasion x city, product x city and
// district pages (src/lib/seo/occasions.ts, products.ts, districts.ts).
// 1) The URL space is closed: slugs and priority city lists are literal, so a
//    data edit can never add or remove an indexed URL by accident.
// 2) The text must stay true whatever the shop inventory: no fee, no online
//    payment, no delivery, no quote or catering, no certification or
//    verification claim, no superlative about shops, no statement that shops
//    are listed (inventory sentences live in the pages, computed from the
//    real list).

import { describe, expect, it } from "vitest";
import { SEO_CITIES } from "@/lib/seo/cities";
import { SEO_DISTRICTS, getCityDistrictCombinations } from "@/lib/seo/districts";
import {
  OCCASION_VILLE_PRIORITY_SLUGS,
  SEO_OCCASIONS,
  getOccasionCityCombinations,
} from "@/lib/seo/occasions";
import {
  PRODUCT_VILLE_PRIORITY_SLUGS,
  SEO_PRODUCTS,
  getProductCityCombinations,
} from "@/lib/seo/products";

const OCCASION_SLUGS = [
  "aid-al-adha",
  "mechoui",
  "mariage",
  "ramadan",
  "aqiqa",
  "barbecue",
  "buffet",
];

const PRODUCT_SLUGS = [
  "merguez-halal",
  "merguez-maison",
  "agneau-halal",
  "gigot-agneau-halal",
  "cote-agneau-halal",
  "boeuf-halal",
  "viande-hachee-halal",
  "kefta-halal",
  "brochettes-halal",
  "poulet-halal",
  "poulet-fermier-halal",
  "viande-pour-couscous",
];

const DISTRICT_PATHS = [
  "lyon/la-guillotiere",
  "lyon/vaise",
  "lyon/croix-rousse",
  "lyon/gerland",
  "venissieux/les-minguettes",
  "villeurbanne/gratte-ciel",
  "villeurbanne/tonkin",
  "grenoble/villeneuve",
  "grenoble/mistral",
  "saint-etienne/tarentaize",
  "saint-etienne/bellevue",
  "chambery/chambery-le-haut",
];

const OCCASION_CITY_SLUGS = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "villeurbanne",
  "venissieux",
  "aix-les-bains",
];

const PRODUCT_CITY_SLUGS = [
  "lyon",
  "grenoble",
  "saint-etienne",
  "chambery",
  "annecy",
  "villeurbanne",
  "venissieux",
];

// Wording rules D6 of chantier C1-SEO, applied to data that is rendered on
// pages whatever the number of shops in the city.
const FORBIDDEN: readonly { id: string; pattern: RegExp }[] = [
  { id: "fee-amount", pattern: /0[,.]99|€|\beuros?\b|frais de service/i },
  {
    id: "online-payment",
    pattern:
      /pay(ez|er) en ligne|paiement (en ligne|sécurisé)|stripe|en ligne ou sur place|virement/i,
  },
  { id: "delivery", pattern: /\blivr/i },
  { id: "pickup-delay", pattern: /\b30 ?min|moins de 30 minutes/i },
  { id: "quote-catering", pattern: /devis|traiteur|48 ?h/i },
  { id: "certification", pattern: /certifi|100 ?% ?halal/i },
  { id: "verification", pattern: /vérifié|vérifiée/i },
  { id: "guarantee", pattern: /garanti/i },
  { id: "real-time", pattern: /temps réel/i },
  {
    id: "superlative",
    pattern:
      /meilleur|première plateforme|les plus actives|plus de \d+ (boucheries|recettes)|des centaines de boucheries/i,
  },
  {
    id: "partner-inventory",
    pattern: /partenaire|klik&go (référence|liste|recense)|déjà inscrite/i,
  },
  { id: "halal-halal", pattern: /halal halal/i },
  { id: "english-decimal", pattern: /\d\.\d/ },
];

// Keys that hold identifiers or dates, not text shown to a reader.
const NON_TEXT_KEYS = new Set([
  "slug",
  "citySlug",
  "zipCode",
  "category",
  "priority",
  "season",
  "eventType",
  "eventStart",
  "eventEnd",
  "lastUpdated",
]);

type TextField = { path: string; text: string };

function collectText(value: unknown, path: string, out: TextField[]): TextField[] {
  if (typeof value === "string") {
    out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectText(item, `${path}[${index}]`, out));
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!NON_TEXT_KEYS.has(key)) collectText(child, `${path}.${key}`, out);
    }
  }
  return out;
}

const ALL_TEXT: TextField[] = [
  ...SEO_OCCASIONS.flatMap((o) => collectText(o, `occasions.${o.slug}`, [])),
  ...SEO_PRODUCTS.flatMap((p) => collectText(p, `products.${p.slug}`, [])),
  ...SEO_DISTRICTS.flatMap((d) => collectText(d, `districts.${d.slug}`, [])),
];

describe("SEO data: closed URL space", () => {
  it("keeps the occasion, product and district slugs unchanged", () => {
    expect(SEO_OCCASIONS.map((o) => o.slug)).toEqual(OCCASION_SLUGS);
    expect(SEO_PRODUCTS.map((p) => p.slug)).toEqual(PRODUCT_SLUGS);
    expect(SEO_DISTRICTS.map((d) => `${d.citySlug}/${d.slug}`)).toEqual(DISTRICT_PATHS);
  });

  it("keeps the priority city lists and the number of generated pages", () => {
    expect([...OCCASION_VILLE_PRIORITY_SLUGS]).toEqual(OCCASION_CITY_SLUGS);
    expect([...PRODUCT_VILLE_PRIORITY_SLUGS]).toEqual(PRODUCT_CITY_SLUGS);
    expect(getOccasionCityCombinations()).toHaveLength(
      OCCASION_SLUGS.length * OCCASION_CITY_SLUGS.length
    );
    expect(getProductCityCombinations()).toHaveLength(
      PRODUCT_SLUGS.length * PRODUCT_CITY_SLUGS.length
    );
    expect(getCityDistrictCombinations()).toHaveLength(DISTRICT_PATHS.length);
  });

  it("attaches every district to an SEO city with the same display name", () => {
    for (const district of SEO_DISTRICTS) {
      const city = SEO_CITIES.find((c) => c.slug === district.citySlug);
      expect(city, district.slug).toBeDefined();
      expect(district.cityName, district.slug).toBe(city?.name);
    }
  });
});

describe("SEO data: names and descriptions", () => {
  it("never puts « halal » in an occasion name (the templates add it)", () => {
    for (const occasion of SEO_OCCASIONS) {
      expect(occasion.name, occasion.slug).not.toMatch(/halal/i);
    }
  });

  it("gives every occasion and product a non-empty short description and intro", () => {
    for (const item of [...SEO_OCCASIONS, ...SEO_PRODUCTS]) {
      expect(item.shortDescription.trim(), item.slug).not.toBe("");
      expect(item.intro.trim(), item.slug).not.toBe("");
    }
  });

  it("dates every occasion text change with an ISO day", () => {
    for (const occasion of SEO_OCCASIONS) {
      expect(occasion.lastUpdated, occasion.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("gives every district a 140-160 character description naming the district and its city", () => {
    for (const district of SEO_DISTRICTS) {
      const label = district.name.replace(/^(La|Le|Les) /, "");
      expect(district.description.length, district.slug).toBeGreaterThanOrEqual(140);
      expect(district.description.length, district.slug).toBeLessThanOrEqual(160);
      expect(district.description, district.slug).toContain(label);
      expect(district.description, district.slug).toContain(district.cityName);
      expect(district.context.trim(), district.slug).not.toBe("");
    }
  });
});

describe("SEO data: wording rules", () => {
  it("collects the text of every entry", () => {
    expect(ALL_TEXT.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN.map((rule) => [rule.id, rule.pattern] as const))(
    "contains no « %s » wording",
    (_id, pattern) => {
      const hits = ALL_TEXT.filter((field) => pattern.test(field.text)).map(
        (field) => `${field.path}: ${field.text.match(pattern)?.[0]}`
      );
      expect(hits).toEqual([]);
    }
  );
});
