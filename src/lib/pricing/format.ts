// src/lib/pricing/format.ts — French text of a weight and of a stored order line.
//
// Used wherever an order line is shown: kitchen card, printed ticket, e-mails, tracking page,
// receipts. Every space inside a quantity is a no-break space (U+00A0), so « 2 × 500 g » never
// wraps in the middle on an 80 mm ticket. Pure and client-safe.

import { describeStoredLine, type StoredLine } from "./line";

const NBSP = " ";
const GRAMS_PER_KG = 1000;

const COUNTED_UNIT_NAMES = {
  PIECE: { singular: "pièce", plural: "pièces" },
  BARQUETTE: { singular: "barquette", plural: "barquettes" },
} as const;

/**
 * A weight in grams: "500 g" below one kilogram, then kilograms with a decimal comma and
 * without trailing zeros, never rounded: "1,2 kg", "2 kg", "1,234 kg".
 * Throws RangeError unless `grams` is a non-negative integer.
 */
export function formatGrams(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams < 0) {
    throw new RangeError(`grams must be a non-negative integer, received ${grams}`);
  }
  if (grams < GRAMS_PER_KG) return `${grams}${NBSP}g`;

  const kilograms = Math.floor(grams / GRAMS_PER_KG);
  const decimals = String(grams % GRAMS_PER_KG)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${decimals === "" ? kilograms : `${kilograms},${decimals}`}${NBSP}kg`;
}

/** A count with a decimal comma. Whole for every row written by the current code. */
function formatCount(count: number): string {
  return String(Number(count.toFixed(3))).replace(".", ",");
}

/**
 * The quantity of a stored order line:
 * - several portions: "2 × 500 g";
 * - one portion, or a row the butcher re-weighed: its total weight, "470 g", "1,5 kg";
 * - counted units: "3 pièces", "1 barquette" (French plural from 2).
 * Throws RangeError on a stored quantity that is negative or not finite.
 */
export function formatStoredLineQuantity(item: StoredLine): string {
  const view = describeStoredLine(item);
  if (!view.weighed) {
    const names = COUNTED_UNIT_NAMES[view.unit];
    return `${formatCount(view.count)}${NBSP}${view.count >= 2 ? names.plural : names.singular}`;
  }
  if (view.portions !== null && view.portions.count > 1) {
    return `${view.portions.count}${NBSP}×${NBSP}${formatGrams(view.portions.gramsEach)}`;
  }
  return formatGrams(view.totalGrams);
}
