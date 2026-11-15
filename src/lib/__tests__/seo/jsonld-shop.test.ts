// @vitest-environment node
//
// JSON-LD of a shop on its own page. Every field comes from the shop's own data: no price range,
// payment methods, cuisine, keywords or region nobody entered. A rating is published only from
// verified reviews (src/lib/reviews/verified-rating.ts), never from Shop.rating / ratingCount, and
// with at most two reviews.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { buildShopJsonLd, type ShopJsonLdInput } from "@/lib/seo/jsonld/shop";
import type { VerifiedShopRating } from "@/lib/reviews/verified-rating";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { SITE_URL } from "@/lib/seo/site";
import { ShopSchema } from "@/components/seo/ShopSchema";

const SHOP: ShopJsonLdInput = {
  id: "shop-1",
  slug: "boucherie-du-test",
  name: "Boucherie du Test",
  description: "Boucherie de quartier.",
  phone: "04 79 00 00 00",
  address: "12 rue des Tests",
  city: "Chambéry",
  imageUrl: "/img/shops/shop-1.jpg",
  latitude: 45.5646,
  longitude: 5.9178,
  openingHours: {
    lundi: { open: "9:00", close: "19:00" },
    mardi: { open: "09:00", close: "19:00" },
    mercredi: null,
    samedi: { open: "08:30", close: "12:30" },
  },
};

const RATING: VerifiedShopRating = {
  average: 4.666666,
  count: 3,
  reviews: [
    {
      rating: 5,
      comment: "Très bon accueil.",
      authorName: "Amina K.",
      createdAt: new Date("2026-10-02T10:00:00Z"),
    },
    {
      rating: 4,
      comment: "Commande prête à l'heure.",
      authorName: "Client",
      createdAt: new Date("2026-09-20T08:00:00Z"),
    },
    {
      rating: 5,
      comment: "Troisième avis.",
      authorName: "Yanis B.",
      createdAt: new Date("2026-09-01T08:00:00Z"),
    },
  ],
};

/** Every key present anywhere in the value, nested objects and arrays included. */
function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    key,
    ...keysIn(nested),
  ]);
}

const UNBACKED_KEYS = [
  "priceRange",
  "paymentAccepted",
  "currenciesAccepted",
  "servesCuisine",
  "acceptsReservations",
  "keywords",
  "alternateName",
  "addressRegion",
];

describe("buildShopJsonLd: only data the shop entered", () => {
  it.each([
    ["without rating", null],
    ["with a verified rating", RATING],
  ] as const)("publishes no unbacked field (%s)", (_label, rating) => {
    const keys = keysIn(buildShopJsonLd(SHOP, rating));
    for (const key of UNBACKED_KEYS) expect(keys).not.toContain(key);
  });

  it("describes the shop page entity with its address, coordinates and pickup order action", () => {
    const url = `${SITE_URL}/boutique/boucherie-du-test`;
    const jsonLd = buildShopJsonLd(SHOP, null);
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": ["Store", "FoodEstablishment", "LocalBusiness"],
      "@id": url,
      url,
      name: "Boucherie du Test",
      description: "Boucherie de quartier.",
      telephone: "04 79 00 00 00",
      image: `${SITE_URL}/img/shops/shop-1.jpg`,
      address: {
        "@type": "PostalAddress",
        streetAddress: "12 rue des Tests",
        addressLocality: "Chambéry",
        addressCountry: "FR",
      },
      geo: { "@type": "GeoCoordinates", latitude: 45.5646, longitude: 5.9178 },
      potentialAction: {
        "@type": "OrderAction",
        target: { "@type": "EntryPoint", urlTemplate: url },
        deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
      },
    });
  });

  it("omits what the shop did not enter: description, phone, photo, coordinates", () => {
    const jsonLd = buildShopJsonLd(
      { ...SHOP, description: "  ", phone: "", imageUrl: null, latitude: null, longitude: 5.9 },
      null
    );
    for (const key of ["description", "telephone", "image", "geo"]) {
      expect(jsonLd).not.toHaveProperty(key);
    }
  });

  it("publishes only a displayable photo of the shop's own, never an expiring one", () => {
    const expiring = buildShopJsonLd(
      { ...SHOP, imageUrl: "https://replicate.delivery/abc/shop.png" },
      null
    );
    expect(expiring).not.toHaveProperty("image");
  });
});

describe("buildShopJsonLd: opening hours", () => {
  it("reads the French day keys through getDayHours, Monday first, closed days left out", () => {
    expect(buildShopJsonLd(SHOP, null).openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "09:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Tuesday",
        opens: "09:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:30",
        closes: "12:30",
      },
    ]);
  });

  it("publishes no week at all when one day carries an unreadable time", () => {
    const openingHours = {
      lundi: { open: "9h", close: "19:00" },
      mardi: { open: "09:00", close: "19:00" },
    };
    const jsonLd = buildShopJsonLd({ ...SHOP, openingHours }, null);
    expect(jsonLd).not.toHaveProperty("openingHoursSpecification");
  });

  it.each([[{}], [null], ["lundi 9-19"], [[1, 2]]])(
    "publishes no hours for empty or malformed data (%j)",
    (openingHours) => {
      expect(buildShopJsonLd({ ...SHOP, openingHours }, null)).not.toHaveProperty(
        "openingHoursSpecification"
      );
    }
  );
});

describe("buildShopJsonLd: verified rating only", () => {
  it("has neither aggregateRating nor review without a verified rating", () => {
    const jsonLd = buildShopJsonLd(SHOP, null);
    expect(jsonLd).not.toHaveProperty("aggregateRating");
    expect(jsonLd).not.toHaveProperty("review");
    expect(serializeJsonLd(jsonLd)).not.toMatch(/aggregateRating|"Review"|"Rating"/);
  });

  it("publishes the verified average rounded to one decimal and the verified count", () => {
    expect(buildShopJsonLd(SHOP, RATING).aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.7,
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("publishes at most two reviews, in the given order", () => {
    const reviews = buildShopJsonLd(SHOP, RATING).review;
    expect(reviews).toEqual([
      {
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: "Amina K." },
        datePublished: "2026-10-02T10:00:00.000Z",
        reviewBody: "Très bon accueil.",
      },
      {
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: 4, bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: "Client" },
        datePublished: "2026-09-20T08:00:00.000Z",
        reviewBody: "Commande prête à l'heure.",
      },
    ]);
  });

  it("keeps the aggregate but no review array when no verified review has a text", () => {
    const jsonLd = buildShopJsonLd(SHOP, { average: 4, count: 1, reviews: [] });
    expect(jsonLd).toHaveProperty("aggregateRating.reviewCount", 1);
    expect(jsonLd).not.toHaveProperty("review");
  });

  it("refuses a rating without any verified review", () => {
    expect(() => buildShopJsonLd(SHOP, { average: 0, count: 0, reviews: [] })).toThrow(RangeError);
  });
});

describe("<ShopSchema>", () => {
  it("renders the builder output in one JSON-LD script", () => {
    const html = renderToStaticMarkup(createElement(ShopSchema, { shop: SHOP, rating: RATING }));
    expect(html).toBe(
      `<script type="application/ld+json">${serializeJsonLd(buildShopJsonLd(SHOP, RATING))}</script>`
    );
  });
});
