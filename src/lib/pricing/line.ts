// src/lib/pricing/line.ts — the order line: quantity, weight and line total.
//
// A line exists in three forms, and this module is the only place that converts
// between them:
//
//   request / cart   LineQuantity   quantity = number of portions (KG, TRANCHE) or of
//                                   units (PIECE, BARQUETTE); weightGrams = grams of ONE
//                                   portion, required for weighed units, forbidden otherwise.
//   storage          StoredLine     OrderItem as written: quantity = KILOGRAMS for weighed
//                                   units (portions x weightGrams / 1000), count otherwise;
//                                   weightGrams = grams of one requested portion or null.
//   display          StoredLineView what a screen can say about a stored row.
//
// The storage form is the historical one: the butcher's weight adjustment rewrites
// `quantity` with the kilograms actually weighed, and the code running before this
// module reads the same rows during a deploy and after a rollback.
//
// Pure and client-safe: no database, no clock, no I/O. Amounts are integer cents,
// weights integer grams.

export type SaleUnit = "KG" | "PIECE" | "BARQUETTE" | "TRANCHE";

/** Most portions or units one line may carry. */
export const MAX_LINE_QUANTITY = 99;
/** Heaviest single portion, in grams. Product min/max/step are a UI concern, not a server bound. */
export const MAX_PORTION_GRAMS = 50_000;

const GRAMS_PER_KG = 1000;

/** KG and TRANCHE are priced per kilogram and carry a weight; PIECE and BARQUETTE are counted. */
export function isWeighedUnit(unit: SaleUnit): unit is "KG" | "TRANCHE" {
  return unit === "KG" || unit === "TRANCHE";
}

/** Throws RangeError unless `value` is an amount in whole, non-negative cents. */
export function assertCents(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${name} must be a non-negative integer number of cents, received ${value}`
    );
  }
}

/** Cart / request line: quantity = portions (KG, TRANCHE) or units; weightGrams = grams of ONE portion. */
export interface LineQuantity {
  unit: SaleUnit;
  quantity: number;
  weightGrams?: number | null;
}

export type LineQuantityIssue =
  | "QUANTITY_INVALID"
  | "WEIGHT_REQUIRED"
  | "WEIGHT_FORBIDDEN"
  | "WEIGHT_INVALID";

/** French reason of each refusal, shown beside the line in the cart. */
export const LINE_QUANTITY_ISSUE_MESSAGES: Record<LineQuantityIssue, string> = {
  QUANTITY_INVALID: "Quantité invalide",
  WEIGHT_REQUIRED: "Poids requis pour un produit vendu au poids",
  WEIGHT_FORBIDDEN: "Ce produit se vend à l'unité : aucun poids n'est attendu",
  WEIGHT_INVALID: "Poids invalide",
};

type InspectedLine =
  | { issue: LineQuantityIssue }
  | { issue: null; quantity: number; gramsEach: number | null };

function inspectLine(line: LineQuantity): InspectedLine {
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
    return { issue: "QUANTITY_INVALID" };
  }
  const weightGrams = line.weightGrams ?? null;
  if (!isWeighedUnit(line.unit)) {
    return weightGrams === null
      ? { issue: null, quantity: line.quantity, gramsEach: null }
      : { issue: "WEIGHT_FORBIDDEN" };
  }
  if (weightGrams === null) return { issue: "WEIGHT_REQUIRED" };
  if (!Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > MAX_PORTION_GRAMS) {
    return { issue: "WEIGHT_INVALID" };
  }
  return { issue: null, quantity: line.quantity, gramsEach: weightGrams };
}

function validLine(line: LineQuantity): { quantity: number; gramsEach: number | null } {
  const inspected = inspectLine(line);
  if (inspected.issue !== null) {
    throw new RangeError(
      `Invalid order line (${inspected.issue}): unit ${line.unit}, quantity ${line.quantity}, weightGrams ${line.weightGrams}`
    );
  }
  return inspected;
}

/**
 * Why a request line cannot be priced, or null when it can.
 * - quantity: integer in 1..MAX_LINE_QUANTITY;
 * - weighed units: integer weight in 1..MAX_PORTION_GRAMS, required;
 * - counted units: no weight at all (null or undefined only).
 */
export function checkLineQuantity(line: LineQuantity): LineQuantityIssue | null {
  return inspectLine(line).issue;
}

/**
 * Price of one portion of `grams` at a per-kilogram price: floor((pricePerKgCents * grams + 500) / 1000),
 * that is half-up to the cent in integer arithmetic. Throws RangeError unless both arguments are
 * non-negative integers.
 */
export function portionPriceCents(pricePerKgCents: number, grams: number): number {
  assertCents("pricePerKgCents", pricePerKgCents);
  if (!Number.isSafeInteger(grams) || grams < 0) {
    throw new RangeError(`grams must be a non-negative integer, received ${grams}`);
  }
  return Math.floor((pricePerKgCents * grams + GRAMS_PER_KG / 2) / GRAMS_PER_KG);
}

/**
 * Total of a request line. `unitPriceCents` is per kilogram for weighed units, per unit otherwise.
 * Weighed: quantity x portionPriceCents — N identical portions cost exactly N times the displayed
 * portion price. Throws RangeError when checkLineQuantity(line) !== null or the price is not whole cents.
 */
export function lineTotalCents(line: LineQuantity, unitPriceCents: number): number {
  const { quantity, gramsEach } = validLine(line);
  assertCents("unitPriceCents", unitPriceCents);
  return gramsEach === null
    ? quantity * unitPriceCents
    : quantity * portionPriceCents(unitPriceCents, gramsEach);
}

/**
 * Limited-stock units taken by a request line: one portion, piece or tray is one unit, never
 * kilograms. Throws RangeError on an invalid line.
 */
export function lineUnits(line: LineQuantity): number {
  return validLine(line).quantity;
}

/** OrderItem as stored: quantity = kg for KG/TRANCHE, count otherwise. */
export interface StoredLine {
  unit: SaleUnit;
  quantity: number;
  weightGrams: number | null;
}

/** OrderItem.quantity of a request line: kilograms for weighed units, the count otherwise. Throws RangeError on an invalid line. */
export function toStoredQuantity(line: LineQuantity): number {
  const { quantity, gramsEach } = validLine(line);
  return gramsEach === null ? quantity : (quantity * gramsEach) / GRAMS_PER_KG;
}

/**
 * What a stored row says.
 * - weighed: `totalGrams` = round(quantity x 1000); `portions` only when the row still splits
 *   exactly into whole portions (totalGrams === count x gramsEach), null once a butcher weight
 *   adjustment rewrote the kilograms;
 * - counted: `count` = the stored quantity (rows written before the server refused fractional
 *   counts may hold one).
 */
export type StoredLineView =
  | {
      unit: "KG" | "TRANCHE";
      weighed: true;
      totalGrams: number;
      portions: { count: number; gramsEach: number } | null;
      count: null;
    }
  | {
      unit: "PIECE" | "BARQUETTE";
      weighed: false;
      totalGrams: null;
      portions: null;
      count: number;
    };

function splitIntoPortions(
  totalGrams: number,
  gramsEach: number | null
): { count: number; gramsEach: number } | null {
  if (totalGrams < 1) return null;
  // Rows written before the portion weight was mandatory: the whole weight is one portion.
  if (gramsEach === null) return { count: 1, gramsEach: totalGrams };
  if (!Number.isInteger(gramsEach) || gramsEach < 1) return null;
  const count = Math.round(totalGrams / gramsEach);
  return count >= 1 && count * gramsEach === totalGrams ? { count, gramsEach } : null;
}

/**
 * Reads a stored row, including rows written before this module. Throws RangeError on a
 * quantity that no writer can have produced (negative or not finite).
 */
export function describeStoredLine(item: StoredLine): StoredLineView {
  if (!Number.isFinite(item.quantity) || item.quantity < 0) {
    throw new RangeError(
      `Stored quantity must be a non-negative number, received ${item.quantity}`
    );
  }
  if (!isWeighedUnit(item.unit)) {
    return {
      unit: item.unit,
      weighed: false,
      totalGrams: null,
      portions: null,
      count: item.quantity,
    };
  }
  const totalGrams = Math.round(item.quantity * GRAMS_PER_KG);
  return {
    unit: item.unit,
    weighed: true,
    totalGrams,
    portions: splitIntoPortions(totalGrams, item.weightGrams),
    count: null,
  };
}

/**
 * Cart line rebuilt from a stored row (reorder, old session carts, chat). A weighed row with no
 * usable split becomes one portion of its total weight. The result describes the row faithfully
 * and may therefore be a line the server refuses (a count of 1,5, a 60 kg portion, a row weighed
 * at 0 g): pass it to checkLineQuantity before using it.
 */
export function lineQuantityFromStored(item: StoredLine): LineQuantity {
  const view = describeStoredLine(item);
  if (!view.weighed) return { unit: view.unit, quantity: view.count };
  return view.portions === null
    ? { unit: view.unit, quantity: 1, weightGrams: view.totalGrams }
    : { unit: view.unit, quantity: view.portions.count, weightGrams: view.portions.gramsEach };
}

/**
 * Limited-stock units held by a stored row, always a whole number.
 * - weighed: the number of portions, or 1 when the row no longer splits into portions;
 * - counted: the count; a fractional count (rows written before the server refused them)
 *   occupies the next whole unit, because the rest of a piece cannot be sold to someone else.
 */
export function storedLineUnits(item: StoredLine): number {
  const view = describeStoredLine(item);
  if (!view.weighed) return Math.ceil(view.count);
  return view.portions === null ? 1 : view.portions.count;
}
