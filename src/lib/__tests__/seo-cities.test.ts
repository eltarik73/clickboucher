// @vitest-environment node
//
// Integrity tests for the SEO city catalog. These pages are SSG'd and indexed,
// so a duplicate slug or a malformed entry would silently break canonical URLs
// and the sitemap. We pin the structural invariants here so future edits to
// the city data surface the regression at test time, not at deploy time.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  CITY_CONTENT_UPDATED,
  SEO_CITIES,
  SEO_DEPARTMENTS,
  getDepartmentForCity,
} from "@/lib/seo/cities";

// The set of city pages is part of the public URL space: adding or removing a
// city is a deliberate decision, never a side effect of a data edit.
const EXPECTED_SLUGS = [
  "aix-les-bains",
  "albens",
  "albertville",
  "annecy",
  "annemasse",
  "barberaz",
  "bassens",
  "bissy",
  "bourgoin-jallieu",
  "brison-saint-innocent",
  "bron",
  "challes-les-eaux",
  "chambery",
  "cluses",
  "cognin",
  "decines-charpieu",
  "drumettaz-clarafond",
  "echirolles",
  "firminy",
  "fontaine",
  "givors",
  "grenoble",
  "gresy-sur-aix",
  "jacob-bellecombette",
  "la-motte-servolex",
  "la-ravoire",
  "le-bourget-du-lac",
  "lyon",
  "mery",
  "meyzieu",
  "montmelian",
  "mouxy",
  "oullins",
  "pont-de-beauvoisin",
  "pugny-chatenod",
  "rillieux-la-pape",
  "roanne",
  "saint-alban-leysse",
  "saint-baldoph",
  "saint-cassin",
  "saint-etienne",
  "saint-jean-de-maurienne",
  "saint-martin-dheres",
  "saint-priest",
  "sonnaz",
  "thonon-les-bains",
  "tresserve",
  "vaulx-en-velin",
  "venissieux",
  "vienne",
  "villeurbanne",
  "vimines",
  "voglans",
  "voiron",
  "yenne",
];

// Savoie communes that had no department before the data was split by department.
const FORMER_ORPHANS = [
  "bassens",
  "voglans",
  "sonnaz",
  "vimines",
  "saint-cassin",
  "saint-baldoph",
  "drumettaz-clarafond",
  "gresy-sur-aix",
  "tresserve",
  "mouxy",
  "brison-saint-innocent",
  "mery",
  "albens",
  "yenne",
  "pugny-chatenod",
];

// Wording that made the city data false (fees, online payment, pickup delay,
// certification guarantee, real time, delivery, community percentages,
// superlatives, quotes and catering). The chantier-wide authority is
// src/lib/seo/claims.ts; this pins the data files on their own.
const FORBIDDEN_WORDING =
  /0[,.]99|en ligne ou sur place|payez en ligne|paiement en ligne|certifi|temps réel|30 ?min|livr|\d+ ?%|meilleur|première plateforme|plus actives|devis|traiteur|vérifié/i;

// Present-tense statements about shops of the city (decision D6 W8): the data
// must stay true when the city has no shop at all.
const SHOP_INVENTORY_STATEMENT =
  /\b(boucheries?|bouchers?)\b[^.]*\b(servent|desservent|proposent|approvisionnent|sélectionnent|couvrent|prennent|accueille|sont implantées)\b/i;

const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;

function cityTexts() {
  return SEO_CITIES.flatMap((city) => [
    { where: `${city.slug}.description`, text: city.description },
    { where: `${city.slug}.localContext`, text: city.localContext },
    { where: `${city.slug}.specialty`, text: city.specialty },
  ]);
}

function departmentTexts() {
  return SEO_DEPARTMENTS.flatMap((dept) => [
    { where: `${dept.slug}.description`, text: dept.description },
    { where: `${dept.slug}.context`, text: dept.context },
  ]);
}

describe("SEO_CITIES catalog", () => {
  it("should expose exactly the 55 expected cities", () => {
    expect(SEO_CITIES.map((c) => c.slug).sort()).toEqual(EXPECTED_SLUGS);
  });

  it("should have a unique slug for every city (collisions break /boucherie-halal/[ville] routing)", () => {
    const slugs = SEO_CITIES.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("should list Savoie first, starting with Chambéry", () => {
    expect(SEO_CITIES[0].slug).toBe("chambery");
    const firstOther = SEO_CITIES.findIndex((c) => c.region !== "Savoie");
    const lastSavoie = SEO_CITIES.map((c) => c.region).lastIndexOf("Savoie");
    expect(lastSavoie).toBeLessThan(firstOther);
  });

  it("should populate the required string fields on every entry", () => {
    for (const city of SEO_CITIES) {
      expect(city.slug.length).toBeGreaterThan(0);
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.region.length).toBeGreaterThan(0);
      expect(city.description.length).toBeGreaterThan(0);
      expect(city.specialty.length).toBeGreaterThan(0);
      // Local context paragraph improves topical authority — keep it substantial
      expect(city.localContext.length).toBeGreaterThanOrEqual(120);
    }
  });

  it("should keep every slug in kebab-case (lowercase, ASCII, hyphen-only)", () => {
    // Spaces, accents, or uppercase in a slug create ugly/invalid URLs and
    // diverge from the canonical we put in the sitemap.
    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const city of SEO_CITIES) {
      expect(city.slug).toMatch(kebab);
    }
  });

  it("should expose plausible latitude/longitude for every city (used by ShopSchema)", () => {
    for (const city of SEO_CITIES) {
      // France bounding box — keeps us safe against obvious "0,0" defaults
      expect(city.latitude).toBeGreaterThan(41);
      expect(city.latitude).toBeLessThan(52);
      expect(city.longitude).toBeGreaterThan(-5);
      expect(city.longitude).toBeLessThan(10);
    }
  });
});

describe("City meta descriptions", () => {
  it("should be 140 to 160 characters long", () => {
    for (const city of SEO_CITIES) {
      expect(city.description.length, city.slug).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(city.description.length, city.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it("should all be distinct", () => {
    const descriptions = SEO_CITIES.map((c) => c.description);
    expect(new Set(descriptions).size).toBe(55);
  });

  it("should name the city and target « boucherie halal »", () => {
    for (const city of SEO_CITIES) {
      expect(city.description, city.slug).toContain(city.name);
      expect(city.description.toLowerCase(), city.slug).toContain("boucherie halal");
    }
  });
});

describe("SEO_DEPARTMENTS", () => {
  it("should put every city in exactly one department", () => {
    for (const city of SEO_CITIES) {
      const owners = SEO_DEPARTMENTS.filter((d) => d.citySlugs.includes(city.slug));
      expect(
        owners.map((d) => d.slug),
        city.slug
      ).toHaveLength(1);
    }
  });

  it("should list, across the five departments, every city once and nothing else", () => {
    expect(SEO_DEPARTMENTS.map((d) => d.slug)).toEqual([
      "savoie",
      "haute-savoie",
      "isere",
      "rhone",
      "loire",
    ]);
    const listed = SEO_DEPARTMENTS.flatMap((d) => d.citySlugs);
    expect(listed).toHaveLength(SEO_CITIES.length);
    expect(listed).toHaveLength(55);
    expect([...listed].sort()).toEqual(EXPECTED_SLUGS);
  });

  it("should give every city the name of its department as region", () => {
    for (const city of SEO_CITIES) {
      expect(getDepartmentForCity(city.slug)?.name, city.slug).toBe(city.region);
    }
  });

  it("should place the 15 former orphan communes in Savoie", () => {
    for (const slug of FORMER_ORPHANS) {
      expect(getDepartmentForCity(slug)?.slug, slug).toBe("savoie");
    }
  });

  it("should have distinct descriptions of 140 to 160 characters naming the department", () => {
    for (const dept of SEO_DEPARTMENTS) {
      expect(dept.description.length, dept.slug).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(dept.description.length, dept.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(dept.description, dept.slug).toContain(dept.name);
      expect(dept.context.length, dept.slug).toBeGreaterThanOrEqual(300);
    }
    expect(new Set(SEO_DEPARTMENTS.map((d) => d.description)).size).toBe(5);
  });

  it("should spell the Savoie valley Tarentaise and keep the Saint-Étienne district Tarentaize", () => {
    const savoie = SEO_DEPARTMENTS.find((d) => d.slug === "savoie");
    expect(savoie?.context).toContain("Tarentaise");
    expect(savoie?.context).not.toContain("Tarentaize");
    const saintEtienne = SEO_CITIES.find((c) => c.slug === "saint-etienne");
    expect(saintEtienne?.districts).toContain("Tarentaize");
  });
});

describe("City and department wording", () => {
  it("should carry no fee figure, online payment, delay promise, certification or superlative", () => {
    for (const { where, text } of [...cityTexts(), ...departmentTexts()]) {
      expect(text.match(FORBIDDEN_WORDING)?.[0], where).toBeUndefined();
    }
  });

  it("should state nothing about the shops of a city (true with zero shop)", () => {
    for (const { where, text } of [...cityTexts(), ...departmentTexts()]) {
      expect(text.match(SHOP_INVENTORY_STATEMENT)?.[0], where).toBeUndefined();
    }
  });
});

describe("City content date", () => {
  it("should be an ISO calendar date, and so should every per-city override", () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    expect(CITY_CONTENT_UPDATED).toMatch(iso);
    for (const city of SEO_CITIES) {
      if (city.lastUpdated !== undefined) expect(city.lastUpdated, city.slug).toMatch(iso);
    }
  });
});

describe("City data files", () => {
  it("should each stay under 300 lines", () => {
    const seoDir = join(process.cwd(), "src/lib/seo");
    const dataDir = join(seoDir, "cities");
    const files = [
      join(seoDir, "cities.ts"),
      ...readdirSync(dataDir).map((name) => join(dataDir, name)),
    ];
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, file).toBeLessThanOrEqual(300);
    }
  });
});
