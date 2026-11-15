// @vitest-environment node
//
// What IndexNow is told: the daily cron sends only the pages whose sitemap lastmod moved since the
// start of the previous UTC day (unchanged pages are not resubmitted), the admin validation only
// the home page and the shop's city pages. Never a shop page.

import { describe, expect, it } from "vitest";
import {
  countFreshByFamily,
  freshIndexNowUrls,
  previousUtcDayStart,
  validationIndexNowUrls,
} from "@/lib/seo/indexnow-urls";
import {
  buildSitemapEntries,
  type SitemapData,
  type SitemapEntry,
} from "@/lib/seo/sitemap-entries";
import { SITE_URL } from "@/lib/seo/site";

const NOW = new Date("2031-06-15T03:11:00.000Z");
const YESTERDAY_AFTERNOON = new Date("2031-06-14T15:00:00.000Z");
const LONG_AGO = new Date("2031-01-01T00:00:00.000Z");

const OLD_DATA: SitemapData = {
  shops: [
    { city: "Chambéry", listedAt: LONG_AGO },
    { city: "Lyon", listedAt: LONG_AGO },
  ],
  recipes: [{ slug: "tajine-agneau", updatedAt: LONG_AGO }],
  latestProductUpdate: LONG_AGO,
};

function entry(path: string, lastModified: Date): SitemapEntry {
  return { path, family: "static", lastModified, changeFrequency: "weekly", priority: 0.5 };
}

describe("previousUtcDayStart", () => {
  it.each([
    ["2031-06-15T03:11:00.000Z", "2031-06-14T00:00:00.000Z"],
    ["2031-06-15T00:00:00.000Z", "2031-06-14T00:00:00.000Z"],
    ["2031-06-15T23:59:59.999Z", "2031-06-14T00:00:00.000Z"],
    ["2031-03-01T03:11:00.000Z", "2031-02-28T00:00:00.000Z"],
    ["2032-01-01T03:11:00.000Z", "2031-12-31T00:00:00.000Z"],
  ])("%s → %s", (now, expected) => {
    expect(previousUtcDayStart(new Date(now))).toEqual(new Date(expected));
  });
});

describe("freshIndexNowUrls", () => {
  it("gives an empty list when no page changed", () => {
    expect(freshIndexNowUrls(buildSitemapEntries(OLD_DATA), NOW)).toEqual([]);
  });

  it("returns the pages a shop listed yesterday changed: the home page and its city", () => {
    const data: SitemapData = {
      ...OLD_DATA,
      shops: [...OLD_DATA.shops, { city: "Chambéry", listedAt: YESTERDAY_AFTERNOON }],
    };
    expect(freshIndexNowUrls(buildSitemapEntries(data), NOW)).toEqual([
      SITE_URL,
      `${SITE_URL}/boucherie-halal/chambery`,
    ]);
  });

  it("returns a recipe updated yesterday and the recipe index it changes", () => {
    const data: SitemapData = {
      ...OLD_DATA,
      recipes: [{ slug: "tajine-agneau", updatedAt: YESTERDAY_AFTERNOON }],
    };
    expect(freshIndexNowUrls(buildSitemapEntries(data), NOW)).toEqual([
      `${SITE_URL}/recettes`,
      `${SITE_URL}/recettes/tajine-agneau`,
    ]);
  });

  it("includes the start of the previous UTC day and excludes the instant before it", () => {
    const since = previousUtcDayStart(NOW);
    expect(
      freshIndexNowUrls(
        [entry("/a-propos", since), entry("/contact", new Date(since.getTime() - 1))],
        NOW
      )
    ).toEqual([`${SITE_URL}/a-propos`]);
  });

  it("leaves out a page dated after now", () => {
    expect(freshIndexNowUrls([entry("/a-propos", new Date(NOW.getTime() + 60_000))], NOW)).toEqual(
      []
    );
  });

  it("never returns a shop page, an API route or a private page, even when given one", () => {
    expect(
      freshIndexNowUrls(
        [
          entry("/boutique/el-mektoub", YESTERDAY_AFTERNOON),
          entry("/api/shops", YESTERDAY_AFTERNOON),
          entry("/panier", YESTERDAY_AFTERNOON),
          entry("/boucherie-halal/lyon", YESTERDAY_AFTERNOON),
        ],
        NOW
      )
    ).toEqual([`${SITE_URL}/boucherie-halal/lyon`]);
  });
});

describe("countFreshByFamily", () => {
  it("counts the fresh pages of each family", () => {
    const data: SitemapData = {
      ...OLD_DATA,
      shops: [...OLD_DATA.shops, { city: "Chambéry", listedAt: YESTERDAY_AFTERNOON }],
      recipes: [{ slug: "tajine-agneau", updatedAt: YESTERDAY_AFTERNOON }],
    };
    expect(countFreshByFamily(buildSitemapEntries(data), NOW)).toEqual({
      static: 2,
      city: 1,
      recipe: 1,
    });
  });
});

describe("validationIndexNowUrls", () => {
  it("returns the home page and the city page of a shop in Chambéry, never its shop page", () => {
    const urls = validationIndexNowUrls("Chambéry");
    expect(urls).toEqual([SITE_URL, `${SITE_URL}/boucherie-halal/chambery`]);
    expect(urls.some((url) => url.includes("/boutique/"))).toBe(false);
  });

  it("matches the city name inside a longer city field, whatever the case", () => {
    expect(validationIndexNowUrls("LYON 3e arrondissement")).toEqual([
      SITE_URL,
      `${SITE_URL}/boucherie-halal/lyon`,
    ]);
  });

  it.each([null, "", "   ", "Marseille"])("returns the home page only for %j", (city) => {
    expect(validationIndexNowUrls(city)).toEqual([SITE_URL]);
  });
});
