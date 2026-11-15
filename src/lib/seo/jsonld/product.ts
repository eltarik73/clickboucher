// JSON-LD of a product on its shop's page /boutique/[slug].
//
// The offer states only what is true: the price charged now (the caller resolves it with the
// pricing rules), per kilogram for a weighed product, the availability, pickup at the shop page.
// Never aggregateRating or review (reviews belong to the shop, not to each product), never
// shippingDetails (click and collect only), hasMerchantReturnPolicy (none is published) or
// priceValidUntil (no date backs it). Pure: no I/O, no clock.

import { assertCents, isWeighedUnit, type SaleUnit } from "@/lib/pricing/line";
import { resolveProductImage } from "@/lib/product-images";
import type { JsonLdObject } from "@/lib/seo/jsonld/pages";
import { absoluteMediaUrl } from "@/lib/seo/jsonld/shop";
import { shopPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";

export type ProductJsonLdInput = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Name of the product's first category. */
  category: string | null;
  unit: SaleUnit;
  /**
   * Public unit price at render time, as the quote would charge it (no pro price, no cut
   * option): per kilogram for KG and TRANCHE, per unit for PIECE and BARQUETTE.
   */
  unitPriceCents: number;
  /** The product can be added to a cart now. */
  available: boolean;
};

const CURRENCY = "EUR";
// UN/CEFACT code of the kilogram.
const KILOGRAM = "KGM";

/** Whole cents as a schema.org price: 1911 gives "19.11". */
function schemaPrice(cents: number): string {
  assertCents("unitPriceCents", cents);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function priceJsonLd(unit: SaleUnit, unitPriceCents: number): JsonLdObject {
  const price = schemaPrice(unitPriceCents);
  if (!isWeighedUnit(unit)) return { price, priceCurrency: CURRENCY };
  return {
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price,
      priceCurrency: CURRENCY,
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: KILOGRAM },
    },
  };
}

export function buildProductJsonLd(
  product: ProductJsonLdInput,
  shop: { name: string; slug: string }
): JsonLdObject {
  const description = product.description?.trim() ?? "";
  const image = resolveProductImage({
    name: product.name,
    imageUrl: product.imageUrl,
    category: product.category,
  });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(description !== "" && { description }),
    image: absoluteMediaUrl(image),
    sku: product.id,
    brand: { "@type": "Brand", name: shop.name },
    ...(product.category !== null && { category: product.category }),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(shopPath(shop.slug)),
      ...priceJsonLd(product.unit, product.unitPriceCents),
      itemCondition: "https://schema.org/NewCondition",
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: shop.name },
    },
  };
}
