// @vitest-environment node
//
// Titles and generated descriptions of the programmatic pages: within Google's display limits,
// no « halal halal » (Search Console showed « Buffet halal halal à Lyon »), unique per page and
// free of any claim the page cannot back.

import { describe, it, expect } from "vitest";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  clampDescription,
  cityTitle,
  departmentCityCount,
  departmentLocative,
  departmentTitle,
  districtTitle,
  occasionCityDescription,
  occasionCityTitle,
  partnerDescription,
  partnerTitle,
  productCityDescription,
  productCityTitle,
  sundayDescription,
  sundayTitle,
} from "@/lib/seo/titles";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { SEO_CITIES, SEO_DEPARTMENTS, type SeoCity } from "@/lib/seo/cities";
import { SEO_DISTRICTS } from "@/lib/seo/districts";
import { PRODUCT_VILLE_PRIORITY_SLUGS, SEO_PRODUCTS } from "@/lib/seo/products";
import {
  OCCASION_VILLE_PRIORITY_SLUGS,
  SEO_OCCASIONS,
  type SeoOccasion,
} from "@/lib/seo/occasions";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";

function city(slug: string): SeoCity {
  const found = SEO_CITIES.find((c) => c.slug === slug);
  if (!found) throw new Error(`test setup: unknown city ${slug}`);
  return found;
}

// Occasions as the data will name them (« Barbecue », « Buffet »), whatever it holds today.
const OCCASIONS_UNDER_TEST: SeoOccasion[] = [
  ...SEO_OCCASIONS,
  { ...SEO_OCCASIONS[0], slug: "buffet", name: "Buffet" },
  { ...SEO_OCCASIONS[0], slug: "barbecue", name: "Barbecue" },
];

const titles = [
  ...SEO_CITIES.map(cityTitle),
  ...SEO_DISTRICTS.map(districtTitle),
  ...SEO_DEPARTMENTS.map(departmentTitle),
  ...SUNDAY_CITY_SLUGS.map((slug) => sundayTitle(city(slug))),
  ...SEO_PRODUCTS.flatMap((p) =>
    PRODUCT_VILLE_PRIORITY_SLUGS.map((s) => productCityTitle(p, city(s)))
  ),
  ...OCCASIONS_UNDER_TEST.flatMap((o) =>
    OCCASION_VILLE_PRIORITY_SLUGS.map((s) => occasionCityTitle(o, city(s)))
  ),
  ...SEO_CITIES.map(partnerTitle),
];

const descriptionsByFamily: Record<string, string[]> = {
  sunday: SUNDAY_CITY_SLUGS.map((slug) => sundayDescription(city(slug))),
  product: SEO_PRODUCTS.flatMap((p) =>
    PRODUCT_VILLE_PRIORITY_SLUGS.map((s) => productCityDescription(p, city(s)))
  ),
  occasion: SEO_OCCASIONS.flatMap((o) =>
    OCCASION_VILLE_PRIORITY_SLUGS.map((s) => occasionCityDescription(o, city(s)))
  ),
  renamedOccasion: OCCASIONS_UNDER_TEST.slice(-2).flatMap((o) =>
    OCCASION_VILLE_PRIORITY_SLUGS.map((s) => occasionCityDescription(o, city(s)))
  ),
  partner: SEO_CITIES.map(partnerDescription),
};

describe("titles", () => {
  it("never write « halal halal », even for an occasion named « Buffet »", () => {
    const buffet = { ...SEO_OCCASIONS[0], slug: "buffet", name: "Buffet" };
    expect(occasionCityTitle(buffet, city("lyon"))).toBe("Buffet halal à Lyon — Click & collect");
    const buffetHalal = { ...SEO_OCCASIONS[0], slug: "buffet", name: "Buffet halal" };
    expect(occasionCityTitle(buffetHalal, city("lyon"))).toBe(
      "Buffet halal à Lyon — Click & collect"
    );
    for (const title of titles) expect(title).not.toMatch(/halal\s+halal/i);
  });

  it("keep a 23-character city within the limit, with the tagline", () => {
    const longCity = { ...city("lyon"), name: "Saint-Jean-de-Maurienne" };
    expect(longCity.name).toHaveLength(23);
    expect(cityTitle(longCity).length).toBeLessThanOrEqual(TITLE_MAX);
    expect(cityTitle(longCity)).toBe("Boucherie halal Saint-Jean-de-Maurienne — Click & collect");
    expect(partnerTitle(longCity).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("stay within TITLE_MAX characters for every page of the data", () => {
    for (const title of titles) expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("follow the agreed formats", () => {
    expect(cityTitle(city("chambery"))).toBe("Boucherie halal Chambéry — Click & collect");
    expect(partnerTitle(city("lyon"))).toBe("Boucher partenaire Lyon — Sans abonnement");
    const savoie = SEO_DEPARTMENTS.find((dept) => dept.slug === "savoie")!;
    expect(departmentTitle(savoie)).toBe(
      `Boucheries halal en Savoie — ${departmentCityCount(savoie)} villes`
    );
    const rhone = SEO_DEPARTMENTS.find((dept) => dept.slug === "rhone")!;
    expect(departmentTitle(rhone)).toMatch(/^Boucheries halal dans le Rhône — \d+ villes$/);
  });

  it("drop the tagline rather than overflow", () => {
    const longDistrict = { ...SEO_DISTRICTS[0], name: "Chambéry-le-Haut", cityName: "Chambéry" };
    expect(districtTitle(longDistrict)).toBe("Boucherie halal Chambéry-le-Haut (Chambéry)");
  });

  it("carry no forbidden claim", () => {
    for (const title of titles) expect(findForbiddenClaims(title), title).toEqual([]);
  });
});

describe("department helpers", () => {
  it("count the real city pages of each department", () => {
    for (const dept of SEO_DEPARTMENTS) {
      const pages = SEO_CITIES.filter((c) => dept.citySlugs.includes(c.slug)).length;
      expect(departmentCityCount(dept)).toBe(pages);
      expect(departmentTitle(dept)).toContain(`— ${pages} ville`);
    }
  });

  it("know the French locative of every department and refuse an unknown one", () => {
    for (const dept of SEO_DEPARTMENTS)
      expect(departmentLocative(dept)).toMatch(/^(en|dans le|dans la) /);
    expect(() => departmentLocative({ ...SEO_DEPARTMENTS[0], slug: "ain" })).toThrow(/ain/);
  });
});

describe("generated descriptions", () => {
  it(`are between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters for every page`, () => {
    for (const [family, descriptions] of Object.entries(descriptionsByFamily)) {
      for (const description of descriptions) {
        expect(description.length, `${family}: ${description}`).toBeGreaterThanOrEqual(
          DESCRIPTION_MIN
        );
        expect(description.length, `${family}: ${description}`).toBeLessThanOrEqual(
          DESCRIPTION_MAX
        );
      }
    }
  });

  it("are unique within each family and name the city", () => {
    for (const [family, descriptions] of Object.entries(descriptionsByFamily)) {
      expect(new Set(descriptions).size, family).toBe(descriptions.length);
    }
    expect(sundayDescription(city("annecy"))).toContain("Annecy");
    expect(partnerDescription(city("bissy"))).toContain("Bissy");
  });

  it("state no fee, payment, delay, certification or count", () => {
    for (const descriptions of Object.values(descriptionsByFamily)) {
      for (const description of descriptions) {
        expect(findForbiddenClaims(description), description).toEqual([]);
        expect(description, description).not.toMatch(/frais|paiement|payez|\d/i);
      }
    }
  });
});

describe("clampDescription", () => {
  // Deterministic pseudo-random texts: words of 1 to 14 letters, some followed by punctuation.
  function texts(): string[] {
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const out: string[] = [];
    for (let t = 0; t < 200; t += 1) {
      const words: string[] = [];
      const count = 1 + Math.floor(next() * 60);
      for (let w = 0; w < count; w += 1) {
        const length = 1 + Math.floor(next() * 14);
        const word = "éabcdefghijklmnopqrstuvwxyz".slice(0, length);
        const punctuation = next() < 0.2 ? [",", ";", " :", " —", "."][Math.floor(next() * 5)] : "";
        words.push(`${word}${punctuation}`);
      }
      out.push(words.join(next() < 0.5 ? " " : "  "));
    }
    return out;
  }

  it("never exceeds its max and never cuts a word", () => {
    for (const text of texts()) {
      const normalized = text.replace(/\s+/g, " ").trim();
      for (const max of [20, 45, 60, 100, 160]) {
        const clamped = clampDescription(text, max);
        expect(clamped.length).toBeLessThanOrEqual(max);
        if (normalized.length <= max) {
          expect(clamped).toBe(normalized);
          continue;
        }
        expect(clamped.endsWith("…")).toBe(true);
        const kept = clamped.slice(0, -1);
        expect(normalized.startsWith(kept)).toBe(true);
        // The character after the kept text ends a word: a space or punctuation, never a letter.
        expect(normalized[kept.length]).toMatch(/[\s,;:—.-]/);
        expect(kept).not.toMatch(/[\s,;:—–-]$/);
      }
    }
  });

  it("defaults to DESCRIPTION_MAX and normalizes spaces", () => {
    expect(clampDescription("  Boucherie   halal à Lyon  ")).toBe("Boucherie halal à Lyon");
    const long = Array.from({ length: 40 }, () => "viande").join(" ");
    expect(clampDescription(long).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("refuses to cut a single word longer than max", () => {
    expect(() => clampDescription("anticonstitutionnellement", 10)).toThrow(RangeError);
  });
});
