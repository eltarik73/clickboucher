// @vitest-environment node
//
// Integrity tests for the SEO city catalog. These pages are SSG'd and indexed,
// so a duplicate slug or a malformed entry would silently break canonical URLs
// and the sitemap. We pin the structural invariants here so future edits to
// cities.ts surface the regression at test time, not at deploy time.

import { describe, it, expect } from "vitest";
import { SEO_CITIES } from "@/lib/seo/cities";

describe("SEO_CITIES catalog", () => {
  it("should expose at least one city (sanity check the export was not emptied)", () => {
    expect(SEO_CITIES.length).toBeGreaterThan(0);
  });

  it("should have a unique slug for every city (collisions break /boucherie-halal/[ville] routing)", () => {
    const slugs = SEO_CITIES.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("should populate the required string fields on every entry", () => {
    for (const city of SEO_CITIES) {
      expect(city.slug.length).toBeGreaterThan(0);
      expect(city.name.length).toBeGreaterThan(0);
      expect(city.region.length).toBeGreaterThan(0);
      // SEO meta description shows up in Google snippets — non-empty is mandatory
      expect(city.description.length).toBeGreaterThan(0);
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
