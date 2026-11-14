// src/lib/pricing/limited-stock.ts — what the storefront may still sell of a limited product.
//
// An anti-gaspi or flash-sale product carries a counter of sale units (one portion, piece or tray)
// while it is in that mode. The counter reaches 0 and the product stays in its mode at 0: the quote
// refuses it until the butcher ends the mode or gives stock back. The storefront reads the same
// counters here to show « Épuisé » instead of an add button. Pure and client-safe.
import type { Prisma } from "@prisma/client";

/** The limited-mode columns of Product. Absent fields mean the mode is off. */
export interface LimitedStockFields {
  isAntiGaspi?: boolean | null;
  antiGaspiStock?: number | null;
  isFlashSale?: boolean | null;
  flashSaleStock?: number | null;
}

/** From this count down to 1, the storefront prints « Plus que N ». */
export const LOW_LIMITED_STOCK = 5;

/**
 * Units still on sale: the smaller counter of the modes that are on, never below 0.
 * null when no mode with a counter is on (the quantity is not limited).
 */
export function limitedStockRemaining(product: LimitedStockFields): number | null {
  const counters = [
    product.isAntiGaspi ? (product.antiGaspiStock ?? null) : null,
    product.isFlashSale ? (product.flashSaleStock ?? null) : null,
  ].filter((stock): stock is number => stock !== null);
  return counters.length === 0 ? null : Math.max(0, Math.min(...counters));
}

/** A limited product with nothing left: shown « Épuisé », never added to a cart. */
export function limitedStockSoldOut(product: LimitedStockFields): boolean {
  return limitedStockRemaining(product) === 0;
}

/** The N of « Plus que N » (1 to LOW_LIMITED_STOCK), or null when nothing is to be printed. */
export function limitedStockLowCount(product: LimitedStockFields): number | null {
  const remaining = limitedStockRemaining(product);
  return remaining !== null && remaining > 0 && remaining <= LOW_LIMITED_STOCK ? remaining : null;
}

/**
 * The same rule as `!limitedStockSoldOut` as a Prisma filter, for lists and counts read from the
 * database: each mode is off, unlimited (null) or above 0. `NOT: { antiGaspiStock: 0 }` would be
 * wrong: in SQL it also drops the rows whose counter is NULL.
 */
export const limitedStockOnSaleWhere = {
  AND: [
    { OR: [{ isAntiGaspi: false }, { antiGaspiStock: null }, { antiGaspiStock: { gt: 0 } }] },
    { OR: [{ isFlashSale: false }, { flashSaleStock: null }, { flashSaleStock: { gt: 0 } }] },
  ],
} satisfies Prisma.ProductWhereInput;
