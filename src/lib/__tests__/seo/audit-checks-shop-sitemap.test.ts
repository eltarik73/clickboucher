// @vitest-environment node
// seo-audit cron checks (C1-SEO, FIX-01, FIX-02, FIX-03, FIX-13), shop pages, sitemap and
// robots.txt: a shop page publishes a rating only from its verified reviews and with their exact
// count, never on a Product; the sitemap has every city page and no /boutique/ URL. The clean
// shop pages are built with the real Store and Product builders (src/lib/seo/jsonld/*).
import { describe, expect, it } from "vitest";
import { robotsTxtProblems, shopPageProblems, sitemapProblems } from "@/lib/seo/audit-checks";
import { SEO_CITIES } from "@/lib/seo/cities";
import { buildProductJsonLd } from "@/lib/seo/jsonld/product";
import { buildShopJsonLd } from "@/lib/seo/jsonld/shop";
import { STATIC_PUBLIC_PATHS, cityPath, partnerPath, shopPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import type { VerifiedShopRating } from "@/lib/reviews/verified-rating";
import { CHAMBERY_PATH, html, snap } from "./audit-fixtures";

describe("shopPageProblems", () => {
  const SLUG = "el-mektoub";
  const shop = {
    id: "shop_1",
    slug: SLUG,
    name: "El Mektoub",
    description: "Boucherie de quartier",
    phone: "04 79 00 00 00",
    address: "1 rue de Boigne",
    city: "Chambéry",
    imageUrl: null,
    latitude: 45.57,
    longitude: 5.92,
    openingHours: null,
  };
  const review = {
    rating: 5,
    comment: "Très bon accueil",
    authorName: "Amina K.",
    createdAt: new Date("2031-01-02T10:00:00Z"),
  };
  const rating: VerifiedShopRating = {
    average: 4.5,
    count: 2,
    reviews: [review, { ...review, rating: 4 }],
  };
  const product = buildProductJsonLd(
    {
      id: "p1",
      name: "Merguez",
      description: null,
      imageUrl: null,
      category: "Saucisses",
      unit: "KG",
      unitPriceCents: 1890,
      available: true,
    },
    { name: shop.name, slug: SLUG }
  );
  const page = (jsonLd: unknown[]) =>
    snap(shopPath(SLUG), html({ path: shopPath(SLUG), title: shop.name, jsonLd }));

  it("finds nothing when the page publishes exactly the verified rating, or none", () => {
    expect(shopPageProblems(page([buildShopJsonLd(shop, rating), product]), 2)).toEqual([]);
    expect(shopPageProblems(page([buildShopJsonLd(shop, null), product]), 0)).toEqual([]);
  });

  it("flags a rating published without any verified review", () => {
    expect(shopPageProblems(page([buildShopJsonLd(shop, rating)]), 0)).toEqual([
      "aggregateRating publié sans avis vérifié",
      "review publié sans avis vérifié",
    ]);
  });

  it("flags a reviewCount that is not the verified count, and more reviews than verified", () => {
    const seeded = {
      ...buildShopJsonLd(shop, null),
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.7, reviewCount: 89 },
    };
    expect(shopPageProblems(page([seeded]), 2)).toEqual([
      "reviewCount 89 au lieu de 2 avis vérifiés",
    ]);
    expect(shopPageProblems(page([buildShopJsonLd(shop, rating)]), 1)).toEqual([
      "reviewCount 2 au lieu de 1 avis vérifiés",
      "2 avis publiés pour 1 vérifiés",
    ]);
  });

  it("flags a Product carrying a review or a rating", () => {
    const reviewed = {
      ...product,
      review: [{ "@type": "Review", reviewBody: "Top" }],
      aggregateRating: { reviewCount: 2 },
    };
    expect(shopPageProblems(page([buildShopJsonLd(shop, rating), reviewed]), 2)).toEqual([
      "Product porte aggregateRating",
      "Product porte review",
    ]);
  });

  it("flags a shop page that does not answer 200", () => {
    expect(shopPageProblems(snap(shopPath(SLUG), "", 500), 0)).toEqual([
      "statut HTTP 500 (attendu 200)",
    ]);
  });
});

describe("sitemapProblems", () => {
  const cityPaths = SEO_CITIES.map((item) => cityPath(item.slug));
  const basePaths = [
    ...STATIC_PUBLIC_PATHS,
    ...cityPaths,
    ...SEO_CITIES.map((item) => partnerPath(item.slug)),
  ];
  const xml = (paths: string[]) =>
    `<?xml version="1.0" encoding="UTF-8"?><urlset>${paths.map((path) => `<url><loc>${absoluteUrl(path)}</loc></url>`).join("")}</urlset>`;

  it("finds nothing in a sitemap with every city and no shop page", () => {
    expect(basePaths.length).toBeGreaterThanOrEqual(100);
    expect(sitemapProblems(xml(basePaths), cityPaths)).toEqual([]);
  });

  it("flags a /boutique/ URL, a refused URL and a missing city", () => {
    const paths = [
      ...basePaths.filter((path) => path !== CHAMBERY_PATH),
      shopPath("el-mektoub"),
      "/api/shops",
    ];
    expect(sitemapProblems(xml(paths), cityPaths)).toEqual([
      "1 page(s) /boutique/ dans le sitemap : /boutique/el-mektoub",
      `1 URL refusée(s) par la politique de soumission : ${absoluteUrl("/api/shops")}`,
      `1 page(s) ville absente(s) : ${CHAMBERY_PATH}`,
    ]);
  });

  it("flags a sitemap with fewer than 100 URLs", () => {
    expect(sitemapProblems(xml(cityPaths), cityPaths)).toEqual([
      `seulement ${cityPaths.length} URL (au moins 100 attendues)`,
    ]);
  });
});

describe("robotsTxtProblems", () => {
  it("wants a 200 with a Sitemap line", () => {
    const robots = `User-Agent: *\nDisallow: /api/\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
    expect(robotsTxtProblems(snap("/robots.txt", robots))).toEqual([]);
    expect(robotsTxtProblems(snap("/robots.txt", "User-Agent: *\nAllow: /\n"))).toEqual([
      "pas de ligne Sitemap",
    ]);
    expect(robotsTxtProblems(snap("/robots.txt", "", 404))).toEqual([
      "statut HTTP 404 (attendu 200)",
    ]);
  });
});
