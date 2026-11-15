// @vitest-environment node
// Guard: a rating reaches the visitor only from verified reviews (C1-SEO, IND-2).
//
// The demo shops carry seeded Shop.rating / Shop.ratingCount (4.7 / 89…). Until this fix the list
// pages selected them, printed them on every shop card, ranked the shops by them, and the shop page
// printed « 4.8 · 156 avis » above a JSON-LD that said 3.5 / 2. Now the public pages and the
// components they render read src/lib/reviews/verified-rating.ts (through src/lib/seo/shop-cards.ts
// for the lists) and never name those two columns. The displayed value is rounded exactly as the
// JSON-LD ratingValue. Comments are ignored (source-scan.ts).
import { describe, expect, it } from "vitest";
import { formatRatingValue, publishedRatingValue } from "@/lib/reviews/rating";
import { codeFilesUnder, publishedText } from "./source-scan";

const PUBLIC_RATING_FILES = [
  ...codeFilesUnder("src/app/boucherie-halal"),
  ...codeFilesUnder("src/app/boucheries-halal"),
  ...codeFilesUnder("src/app/boucheries-halal-ouvertes-dimanche"),
  ...codeFilesUnder("src/app/produits"),
  ...codeFilesUnder("src/app/occasions"),
  ...codeFilesUnder("src/app/trouver-boucherie-halal"),
  ...codeFilesUnder("src/app/(client)/(accueil)"),
  ...codeFilesUnder("src/app/(client)/boutique/[slug]"),
  "src/app/(client)/decouvrir/NearbyShops.tsx",
  "src/components/shop/ShopCard.tsx",
  "src/components/shop/ReviewList.tsx",
  "src/lib/seo/shop-cards.ts",
];

const SEEDED_RATING_USES: readonly [string, RegExp][] = [
  ["ratingCount", /\bratingCount\b/],
  ["select rating: true", /\brating\s*:\s*true\b/],
  ["orderBy rating", /\brating\s*:\s*["'](?:asc|desc)["']/],
  ["shop.rating", /\b(?:shop|s)\.rating\b/],
];

describe("public pages never read the seeded Shop.rating / ratingCount", () => {
  it.each(SEEDED_RATING_USES)("no public page or card component uses %s", (_label, pattern) => {
    const offenders = PUBLIC_RATING_FILES.filter((file) => pattern.test(publishedText(file)));
    expect(offenders).toEqual([]);
  });

  it("feeds every list page from the shared shop cards (verified ratings, neutral order)", () => {
    const listPages = [
      "src/app/boucherie-halal/[ville]/page.tsx",
      "src/app/boucherie-halal/[ville]/[quartier]/page.tsx",
      "src/app/boucheries-halal/[departement]/page.tsx",
      "src/app/boucheries-halal-ouvertes-dimanche/[ville]/page.tsx",
      "src/app/produits/[produit]/[ville]/page.tsx",
      "src/app/occasions/[occasion]/[ville]/page.tsx",
      "src/app/trouver-boucherie-halal/page.tsx",
      "src/app/(client)/(accueil)/page.tsx",
    ];
    for (const file of listPages) {
      const code = publishedText(file);
      expect(code, file).toMatch(/\btoShopCards\b/);
      expect(code, file).toMatch(/\bshopCardSelect\b/);
      expect(code, file).toMatch(/\bshopCardOrderBy\(\)/);
    }
  });

  it("detects a seeded rating in code but not in a comment", () => {
    const probe = publishedText("src/lib/seo/shop-cards.ts");
    expect(probe).not.toMatch(/ratingCount/);
    expect('orderBy: { rating: "desc" }').toMatch(SEEDED_RATING_USES[2][1]);
    expect("{shop.rating.toFixed(1)}").toMatch(SEEDED_RATING_USES[3][1]);
  });
});

describe("publishedRatingValue / formatRatingValue", () => {
  it.each([
    [3.5, 3.5, "3.5"],
    [3.45, 3.5, "3.5"],
    [4.349, 4.3, "4.3"],
    [4, 4, "4.0"],
    [4.95, 5, "5.0"],
    [1, 1, "1.0"],
  ])("%s → %s, displayed « %s »", (average, value, text) => {
    expect(publishedRatingValue(average)).toBe(value);
    expect(formatRatingValue(average)).toBe(text);
  });

  it("displays exactly the JSON-LD ratingValue", () => {
    for (let tenths = 10; tenths <= 50; tenths += 1) {
      for (const offset of [-0.05, -0.01, 0, 0.01, 0.049]) {
        const average = tenths / 10 + offset;
        expect(Number(formatRatingValue(average))).toBe(publishedRatingValue(average));
      }
    }
  });
});
