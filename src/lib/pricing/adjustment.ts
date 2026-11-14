// src/lib/pricing/adjustment.ts — the new content of an order line after the butcher weighs or
// prices it again (price-adjustment tiers, /api/orders/[id]/adjust-price).
//
// The line keeps its storage form (see line.ts): quantity in the sale unit (kilograms for KG and
// TRANCHE, a count otherwise), priceCents per sale unit. Its total is computed by line.ts, like at
// checkout: a weight that still splits into the requested portions costs exactly what those
// portions cost, so weighing the same weight again never changes the total.
//
// Pure and client-safe: no database, no clock, no I/O.
import {
  assertCents,
  checkLineQuantity,
  isWeighedUnit,
  lineQuantityFromStored,
  lineTotalCents,
  type StoredLine,
} from "./line";

const GRAMS_PER_KG = 1000;

export interface AdjustableLine extends StoredLine {
  /** Effective unit price of the line: per kilogram for weighed units, per unit otherwise. */
  priceCents: number;
}

export type AdjustedLine =
  | { ok: true; quantity: number; priceCents: number; totalCents: number }
  | { ok: false; reason: "QUANTITY_INVALID" | "PRICE_INVALID" | "LINE_NOT_ADJUSTABLE" };

function totalOf(line: StoredLine, priceCents: number): number | null {
  const request = lineQuantityFromStored(line);
  return checkLineQuantity(request) === null ? lineTotalCents(request, priceCents) : null;
}

/**
 * The line weighed (KG, TRANCHE: `newQuantity` in kilograms, whole grams) or counted (PIECE,
 * BARQUETTE: a whole number) again, at its unit price. 0 means none was delivered: total 0.
 */
export function reweighLine(line: AdjustableLine, newQuantity: number): AdjustedLine {
  assertCents("priceCents", line.priceCents);
  if (!Number.isFinite(newQuantity) || newQuantity < 0)
    return { ok: false, reason: "QUANTITY_INVALID" };
  if (isWeighedUnit(line.unit)) {
    const grams = Math.round(newQuantity * GRAMS_PER_KG);
    if (Math.abs(grams - newQuantity * GRAMS_PER_KG) > 1e-6)
      return { ok: false, reason: "QUANTITY_INVALID" };
    const quantity = grams / GRAMS_PER_KG;
    if (grams === 0) return { ok: true, quantity, priceCents: line.priceCents, totalCents: 0 };
    const totalCents = totalOf(
      { unit: line.unit, quantity, weightGrams: line.weightGrams },
      line.priceCents
    );
    return totalCents === null
      ? { ok: false, reason: "QUANTITY_INVALID" }
      : { ok: true, quantity, priceCents: line.priceCents, totalCents };
  }
  if (!Number.isInteger(newQuantity)) return { ok: false, reason: "QUANTITY_INVALID" };
  if (newQuantity === 0)
    return { ok: true, quantity: 0, priceCents: line.priceCents, totalCents: 0 };
  const totalCents = totalOf(
    { unit: line.unit, quantity: newQuantity, weightGrams: null },
    line.priceCents
  );
  return totalCents === null
    ? { ok: false, reason: "QUANTITY_INVALID" }
    : { ok: true, quantity: newQuantity, priceCents: line.priceCents, totalCents };
}

/** The line at a new unit price (per kilogram for weighed units), same quantity. */
export function repriceLine(line: AdjustableLine, newPriceCents: number): AdjustedLine {
  if (!Number.isSafeInteger(newPriceCents) || newPriceCents < 0)
    return { ok: false, reason: "PRICE_INVALID" };
  const totalCents = totalOf(line, newPriceCents);
  return totalCents === null
    ? { ok: false, reason: "LINE_NOT_ADJUSTABLE" }
    : { ok: true, quantity: line.quantity, priceCents: newPriceCents, totalCents };
}
