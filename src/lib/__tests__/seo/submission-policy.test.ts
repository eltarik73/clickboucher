// @vitest-environment node
//
// The submission policy (what may ever be sent to a search engine) and the shop-city matching
// rule shared by the sitemap's populated cities and the validation ping.

import { describe, expect, it } from "vitest";
import { seoCitySlugsForShopCity } from "@/lib/seo/city-match";
import { SITE_URL } from "@/lib/seo/site";
import { isSubmittableToEngines } from "@/lib/seo/submission-policy";

describe("isSubmittableToEngines", () => {
  it.each([
    "/",
    "/boucherie-halal/chambery",
    "/boucherie-halal/lyon/croix-rousse",
    "/boucheries-halal/savoie",
    "/devenir-boucher-partenaire/lyon",
    "/espace-boucher",
    "/inscription-boucher",
    "/bons-plans",
    "/recettes/tajine-agneau",
    SITE_URL,
    `${SITE_URL}/`,
    `${SITE_URL}/occasions/aid-al-adha/chambery`,
  ])("accepts the public page %s", (urlOrPath) => {
    expect(isSubmittableToEngines(urlOrPath)).toBe(true);
  });

  it.each([
    "/boutique/el-mektoub",
    "/boutique",
    "/BOUTIQUE/el-mektoub",
    `${SITE_URL}/boutique/el-mektoub`,
    "/api/shops",
    "/api",
    "/boucher/commandes",
    "/admin/shops",
    "/webmaster",
    "/dashboard",
    "/checkout",
    "/panier",
    "/commandes",
    "/commande/abc",
    "/suivi/abc",
    "/validation/abc",
    "/profil",
    "/avantages",
    "/recherche",
    "/onboarding",
    "/sign-in",
    "/sign-up/verify",
    "/shop/offers",
  ])("refuses the shop, API or private page %s", (urlOrPath) => {
    expect(isSubmittableToEngines(urlOrPath)).toBe(false);
  });

  it.each([
    ["another host", "https://example.com/boucherie-halal/chambery"],
    ["a host that only starts like ours", `${SITE_URL}.example.com/boucherie-halal/chambery`],
    ["a protocol-relative URL", "//example.com/boucherie-halal/chambery"],
    ["a relative path without its slash", "boucherie-halal/chambery"],
    ["a query string", "/recettes?tag=agneau"],
    ["a query string on a URL", `${SITE_URL}/recettes?tag=agneau`],
    ["a fragment", "/boucherie-halal/lyon#faq"],
    ["a trailing slash", "/boucherie-halal/lyon/"],
    ["the sitemap file", "/sitemap.xml"],
    ["a text file", `${SITE_URL}/llms.txt`],
    ["an empty string", ""],
    ["a malformed URL", "https://"],
    ["a percent-encoded shop path", "/%62outique/el-mektoub"],
    ["a percent-encoded shop URL", `${SITE_URL}/%62outique/el-mektoub`],
    ["a percent-encoded API URL", `${SITE_URL}/%61pi/shops`],
    ["an encoded character in a public path", "/boucherie-halal/chamb%C3%A9ry"],
  ])("refuses %s", (_label, urlOrPath) => {
    expect(isSubmittableToEngines(urlOrPath)).toBe(false);
  });
});

describe("seoCitySlugsForShopCity", () => {
  it("finds the SEO city a shop city names, whatever the case and spacing", () => {
    expect(seoCitySlugsForShopCity("Chambéry")).toEqual(["chambery"]);
    expect(seoCitySlugsForShopCity("  CHAMBÉRY  ")).toEqual(["chambery"]);
    expect(seoCitySlugsForShopCity("Lyon 7e")).toEqual(["lyon"]);
    expect(seoCitySlugsForShopCity("Saint-Martin-d'Hères")).toEqual(["saint-martin-dheres"]);
  });

  it("returns every SEO city the shop city contains, the longest name first", () => {
    expect(seoCitySlugsForShopCity("Lyon / Villeurbanne")).toEqual(["villeurbanne", "lyon"]);
  });

  it.each([null, undefined, "", "   ", "Marseille"])("returns no city for %j", (city) => {
    expect(seoCitySlugsForShopCity(city)).toEqual([]);
  });
});
