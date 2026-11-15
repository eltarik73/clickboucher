// @vitest-environment node
//
// robots.txt and the sitemap must agree: a Disallow rule matches by prefix, so a rule written
// « /boucher » (without its slash) would block every /boucherie-halal page we submit. And the auth
// pages must stay crawlable, or Google could never read their noindex (verified CRIT-03).

import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { SEO_CITIES } from "@/lib/seo/cities";
import { buildSitemapEntries } from "@/lib/seo/sitemap-entries";

const rules = [robots().rules].flat();
const disallowed = rules.flatMap((rule) => [rule.disallow ?? []].flat());

// Every family present: one listed shop in each SEO city, and a recipe.
const sitemapPaths = buildSitemapEntries({
  shops: SEO_CITIES.map((city) => ({ city: city.name, listedAt: new Date("2027-01-01") })),
  recipes: [{ slug: "tajine-agneau", updatedAt: new Date("2027-01-01") }],
  latestProductUpdate: null,
}).map((entry) => entry.path);

describe("robots.txt rules", () => {
  it("are plain prefixes (no wildcard), so a prefix test is how crawlers read them", () => {
    expect(disallowed.length).toBeGreaterThan(0);
    for (const rule of disallowed) expect(rule, rule).toMatch(/^\/[^*$]*$/);
  });

  it("block no path of the sitemap", () => {
    for (const rule of disallowed) {
      expect(
        sitemapPaths.filter((path) => path.startsWith(rule)),
        `Disallow: ${rule}`
      ).toEqual([]);
    }
  });

  it.each(["/sign-in", "/sign-up"])("leave %s crawlable so its noindex can be read", (path) => {
    expect(disallowed.filter((rule) => path.startsWith(rule))).toEqual([]);
  });
});
