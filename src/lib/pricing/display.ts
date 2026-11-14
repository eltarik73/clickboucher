// src/lib/pricing/display.ts — the public price a product card shows, before the customer adds it.
//
// Same rule as the server (resolveUnitPrice), with one difference: until the component has mounted
// the clock is not read (no clock in a server or hydration render), so a dated promotion is not
// shown yet. Pure and client-safe.

import {
  activeProductPromo,
  resolveUnitPrice,
  type ProductPricing,
  type ProductPromo,
} from "./unit-price";

/** Promotion fields cleared: the product at its base price. */
const WITHOUT_PROMO = {
  promoPct: null,
  promoType: null,
  promoFixedCents: null,
  promoEnd: null,
} as const;

/** Any date: the clock is irrelevant to a promotion without end date. */
const UNDATED_PROMO_CLOCK = new Date(0);

function knownPricing(
  product: ProductPricing,
  now: Date | null
): { pricing: ProductPricing; at: Date } {
  if (now !== null) return { pricing: product, at: now };
  // Before mount the clock is not read: a dated promotion may already be over.
  const dated = product.promoEnd !== null && product.promoEnd !== undefined;
  return { pricing: dated ? { ...product, ...WITHOUT_PROMO } : product, at: UNDATED_PROMO_CLOCK };
}

/**
 * The promotion a product card shows. `now` is null until the component has mounted
 * (no clock in the server or hydration render): only a promotion without end date is shown then.
 */
export function displayedProductPromo(
  product: ProductPricing,
  now: Date | null
): ProductPromo | null {
  const { pricing, at } = knownPricing(product, now);
  return activeProductPromo(pricing, at);
}

/**
 * The public unit price a product card shows (no cut option, no pro price), with its base
 * before promotion. Same rule as displayedProductPromo for `now`.
 */
export function displayedUnitPrice(
  product: ProductPricing,
  now: Date | null
): { unitPriceCents: number; baseCents: number; promo: ProductPromo | null } {
  const { pricing, at } = knownPricing(product, now);
  const price = resolveUnitPrice(pricing, { isPro: false, now: at });
  if (!price.ok)
    throw new Error(`resolveUnitPrice refused a product without cut option: ${price.error}`);
  return { unitPriceCents: price.unitPriceCents, baseCents: price.baseCents, promo: price.promo };
}

/** Badge of a promotion: "-20%" or "-1,50€". */
export function promoBadgeLabel(promo: ProductPromo): string {
  return promo.kind === "FIXED"
    ? `-${(promo.cents / 100).toFixed(2).replace(".", ",")}\u20AC`
    : `-${promo.pct}%`;
}
