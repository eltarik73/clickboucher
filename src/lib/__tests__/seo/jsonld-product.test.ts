// @vitest-environment node
//
// JSON-LD of a product on its shop's page. An offer states only what is true: the price charged
// now, per kilogram for a weighed product (UnitPriceSpecification), the availability, pickup at
// the shop. Never a rating or a review (the shop's reviews are not the product's), never shipping
// details, an invented return policy or an arbitrary price end date, and no clock in the builder.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, expect, vi } from "vitest";
import { buildProductJsonLd, type ProductJsonLdInput } from "@/lib/seo/jsonld/product";
import type { SaleUnit } from "@/lib/pricing/line";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { SITE_URL } from "@/lib/seo/site";
import { ProductSchema } from "@/components/seo/ProductSchema";

const SHOP = { name: "Boucherie du Test", slug: "boucherie-du-test" };
const SHOP_URL = `${SITE_URL}/boutique/boucherie-du-test`;

const BASE: ProductJsonLdInput = {
  id: "prod-1",
  name: "Entrecôte",
  description: "Entrecôte de bœuf.",
  imageUrl: "https://abc.public.blob.vercel-storage.com/products/entrecote.webp",
  category: "Bœuf",
  unit: "PIECE",
  unitPriceCents: 1290,
  available: true,
};

const UNITS: SaleUnit[] = ["KG", "TRANCHE", "PIECE", "BARQUETTE"];
const FORBIDDEN_KEYS = [
  "aggregateRating",
  "review",
  "shippingDetails",
  "hasMerchantReturnPolicy",
  "priceValidUntil",
];

/** Every key present anywhere in the value, nested objects and arrays included. */
function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    key,
    ...keysIn(nested),
  ]);
}

function offersOf(product: ProductJsonLdInput): Record<string, unknown> {
  return buildProductJsonLd(product, SHOP).offers as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildProductJsonLd: nothing unbacked, for any input", () => {
  const inputs: ProductJsonLdInput[] = UNITS.flatMap((unit) =>
    [true, false].flatMap((available) => [
      { ...BASE, unit, available },
      { ...BASE, unit, available, description: null, imageUrl: null, category: null },
    ])
  );

  it.each(inputs.map((input) => [input.unit, input.available, input.description, input]))(
    "%s, available %s, description %j: no rating, review, shipping, return policy or price end date",
    (_unit, _available, _description, input) => {
      const keys = keysIn(buildProductJsonLd(input as ProductJsonLdInput, SHOP));
      for (const key of FORBIDDEN_KEYS) expect(keys).not.toContain(key);
    }
  );

  it("gives the same output whatever the clock says", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const before = serializeJsonLd(buildProductJsonLd(BASE, SHOP));
    vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));
    expect(serializeJsonLd(buildProductJsonLd(BASE, SHOP))).toBe(before);
  });
});

describe("buildProductJsonLd: price of the offer", () => {
  it.each(["KG", "TRANCHE"] as const)(
    "%s: the price per kilogram goes in a UnitPriceSpecification, never in offers.price",
    (unit) => {
      const offers = offersOf({ ...BASE, unit, unitPriceCents: 1911 });
      expect(offers).not.toHaveProperty("price");
      expect(offers).not.toHaveProperty("priceCurrency");
      expect(offers.priceSpecification).toEqual({
        "@type": "UnitPriceSpecification",
        price: "19.11",
        priceCurrency: "EUR",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "KGM" },
      });
    }
  );

  it.each(["PIECE", "BARQUETTE"] as const)("%s: offers.price is the price of one unit", (unit) => {
    const offers = offersOf({ ...BASE, unit, unitPriceCents: 1290 });
    expect(offers).toMatchObject({ price: "12.90", priceCurrency: "EUR" });
    expect(offers).not.toHaveProperty("priceSpecification");
  });

  it.each([
    [5, "0.05"],
    [100, "1.00"],
    [123456, "1234.56"],
  ])("writes %i cents as %s", (unitPriceCents, price) => {
    expect(offersOf({ ...BASE, unitPriceCents })).toHaveProperty("price", price);
  });

  it.each([12.5, -1, Number.NaN])("refuses a price that is not whole cents (%s)", (cents) => {
    expect(() => buildProductJsonLd({ ...BASE, unitPriceCents: cents }, SHOP)).toThrow(RangeError);
  });
});

describe("buildProductJsonLd: product and offer", () => {
  it("describes the product sold by the shop, picked up at its page's shop", () => {
    expect(buildProductJsonLd(BASE, SHOP)).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Entrecôte",
      description: "Entrecôte de bœuf.",
      image: "https://abc.public.blob.vercel-storage.com/products/entrecote.webp",
      sku: "prod-1",
      brand: { "@type": "Brand", name: "Boucherie du Test" },
      category: "Bœuf",
      offers: {
        "@type": "Offer",
        url: SHOP_URL,
        price: "12.90",
        priceCurrency: "EUR",
        itemCondition: "https://schema.org/NewCondition",
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "Boucherie du Test" },
      },
    });
  });

  it("marks an unavailable product out of stock", () => {
    expect(offersOf({ ...BASE, available: false })).toHaveProperty(
      "availability",
      "https://schema.org/OutOfStock"
    );
  });

  it("makes a site image absolute and falls back on the catalogue photo of the product name", () => {
    expect(buildProductJsonLd({ ...BASE, imageUrl: "/img/products/x.jpg" }, SHOP).image).toBe(
      `${SITE_URL}/img/products/x.jpg`
    );
    expect(buildProductJsonLd({ ...BASE, imageUrl: null }, SHOP).image).toBe(
      `${SITE_URL}/img/products/entrecote-boeuf.jpg`
    );
  });

  it("omits an empty description and a missing category", () => {
    const jsonLd = buildProductJsonLd({ ...BASE, description: " ", category: null }, SHOP);
    expect(jsonLd).not.toHaveProperty("description");
    expect(jsonLd).not.toHaveProperty("category");
  });
});

describe("<ProductSchema>", () => {
  it("renders the builder output in one JSON-LD script", () => {
    const html = renderToStaticMarkup(createElement(ProductSchema, { product: BASE, shop: SHOP }));
    expect(html).toBe(
      `<script type="application/ld+json">${serializeJsonLd(buildProductJsonLd(BASE, SHOP))}</script>`
    );
  });
});
