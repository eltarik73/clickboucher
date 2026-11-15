// src/lib/pricing/adjustment.ts — a price adjustment planned: the new content of the lines the
// butcher weighs or prices again, the new order total and whether it applies at once
// (decideAdjustment, tolerance.ts). One planner for the server, which plans under the order lock
// (src/lib/services/orders/adjust-price.ts), and for the butcher's window, which shows the plan
// before sending it.
//
// A line keeps its storage form (see line.ts): quantity in the sale unit (kilograms for KG and
// TRANCHE, a count otherwise), priceCents per sale unit. Its total is computed by line.ts, like at
// checkout: a weight that still splits into the requested portions costs exactly what those
// portions cost, so weighing the same weight again never changes the total.
//
// Pure and client-safe: no database, no clock, no I/O.
import type { AdjustmentStatus } from "@prisma/client";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import {
  assertCents,
  checkLineQuantity,
  isWeighedUnit,
  lineQuantityFromStored,
  lineTotalCents,
  type StoredLine,
} from "./line";
import {
  decideAdjustment,
  frozenToleranceOf,
  type AdjustmentDecision,
  type AdjustmentDecisionInput,
  type EstimatedLine,
  type FrozenToleranceColumns,
} from "./tolerance";

const GRAMS_PER_KG = 1000;

export interface AdjustableLine extends StoredLine {
  /** Effective unit price of the line: per kilogram for weighed units, per unit otherwise. */
  priceCents: number;
}

export type AdjustedLine =
  | { ok: true; quantity: number; priceCents: number; totalCents: number }
  | { ok: false; reason: "QUANTITY_INVALID" | "PRICE_INVALID" | "LINE_NOT_ADJUSTABLE" };

type LineRefusalReason = Extract<AdjustedLine, { ok: false }>["reason"];

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

/** An order line as the weighing tolerance measures it (OrderItem columns). */
export interface MeasuredLine extends EstimatedLine {
  id: string;
  available: boolean;
}

/** An order line as planAdjustment reads it (OrderItem columns). */
export interface PlannableLine extends MeasuredLine, AdjustableLine {
  name: string;
}

export interface PlannableOrder extends FrozenToleranceColumns {
  totalCents: number;
  discountCents: number;
  items: ReadonlyArray<PlannableLine>;
}

export type AdjustmentRefusalReason =
  | "TOTAL_MISSING"
  | "TOTAL_INVALID"
  | "CHANGES_MISSING"
  | "LINE_TWICE"
  | "LINE_UNAVAILABLE"
  | LineRefusalReason;

/** The sentence the butcher reads for each refusal, in his window and from the server alike. */
export const ADJUSTMENT_REFUSALS: Record<AdjustmentRefusalReason, string> = {
  TOTAL_MISSING: "Nouveau total manquant",
  TOTAL_INVALID: "Montant invalide",
  CHANGES_MISSING: "Données d'ajustement manquantes",
  LINE_TWICE: "Article ajusté deux fois",
  LINE_UNAVAILABLE: "Article absent de la commande ou en rupture",
  QUANTITY_INVALID: "Quantité invalide : poids en grammes entiers, nombre entier pour les pièces",
  PRICE_INVALID: "Prix invalide",
  LINE_NOT_ADJUSTABLE: "Cette ligne ne peut pas être ajustée",
};

/** A line of the order after the change. */
export interface PlannedLineChange {
  orderItemId: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
}

export type AdjustmentPlan =
  | {
      ok: true;
      newTotalCents: number;
      /** Nothing moves: the total and every changed line stay as stored. */
      unchanged: boolean;
      lineChanges: PlannedLineChange[];
      decision: AdjustmentDecision;
    }
  | { ok: false; reason: AdjustmentRefusalReason; orderItemId: string | null; message: string };

type Refusal = Extract<AdjustmentPlan, { ok: false }>;

function refused(reason: AdjustmentRefusalReason, orderItemId: string | null = null): Refusal {
  return { ok: false, reason, orderItemId, message: ADJUSTMENT_REFUSALS[reason] };
}

/** A refusal of the value typed for one line, named after it. */
function refusedLine(reason: LineRefusalReason, line: PlannableLine): Refusal {
  const message = `${line.name} : ${ADJUSTMENT_REFUSALS[reason]}`;
  return { ok: false, reason, orderItemId: line.id, message };
}

/** A line of the order and what the request makes of it. */
interface LineChange {
  line: PlannableLine;
  after: PlannedLineChange;
}

/** The lines a WEIGHT or PRICE request names, weighed or priced again; none for MANUAL. */
function changedLines(
  items: ReadonlyArray<PlannableLine>,
  request: AdjustPriceRequest
): { ok: true; changes: LineChange[] } | Refusal {
  if (request.adjustmentType === "MANUAL") return { ok: true, changes: [] };
  const requested = request.items ?? [];
  if (requested.length === 0) return refused("CHANGES_MISSING");
  if (new Set(requested.map((item) => item.orderItemId)).size !== requested.length) {
    return refused("LINE_TWICE");
  }
  const lineById = new Map(items.map((line) => [line.id, line]));
  const changes: LineChange[] = [];
  for (const item of requested) {
    const line = lineById.get(item.orderItemId);
    if (line === undefined || !line.available) return refused("LINE_UNAVAILABLE", item.orderItemId);
    const value = request.adjustmentType === "WEIGHT" ? item.newQuantity : item.newPriceCents;
    if (value === undefined) return refused("CHANGES_MISSING", line.id);
    const adjusted =
      request.adjustmentType === "WEIGHT" ? reweighLine(line, value) : repriceLine(line, value);
    if (!adjusted.ok) return refusedLine(adjusted.reason, line);
    if (!Number.isSafeInteger(adjusted.totalCents)) return refusedLine("PRICE_INVALID", line);
    const { quantity, priceCents, totalCents } = adjusted;
    changes.push({ line, after: { orderItemId: line.id, quantity, priceCents, totalCents } });
  }
  return { ok: true, changes };
}

/**
 * What the request does to the order: the changed lines, the new total (MANUAL: the one typed;
 * otherwise the current total moved by the line differences, never below 0) and the decision on
 * the available lines after the change. A refusal names its reason, the line it concerns when
 * there is one, and the butcher's sentence.
 */
export function planAdjustment(order: PlannableOrder, request: AdjustPriceRequest): AdjustmentPlan {
  const changed = changedLines(order.items, request);
  if (!changed.ok) return changed;
  const differenceCents = changed.changes.reduce(
    (sum, { line, after }) => sum + after.totalCents - line.totalCents,
    0
  );
  const newTotalCents =
    request.adjustmentType === "MANUAL"
      ? request.newTotalCents
      : Math.max(0, order.totalCents + differenceCents);
  if (newTotalCents === undefined) return refused("TOTAL_MISSING");
  if (!Number.isSafeInteger(newTotalCents) || newTotalCents < 0) return refused("TOTAL_INVALID");

  const lineChanges = changed.changes.map(({ after }) => after);
  const unchanged =
    newTotalCents === order.totalCents &&
    changed.changes.every(
      ({ line, after }) =>
        after.quantity === line.quantity &&
        after.priceCents === line.priceCents &&
        after.totalCents === line.totalCents
    );
  const decision = decideAdjustment({
    adjustmentType: request.adjustmentType,
    currentTotalCents: order.totalCents,
    newTotalCents,
    tolerance: frozenToleranceOf(order),
    discountCents: order.discountCents,
    lines: availableLinesAfter(
      order.items,
      lineChanges.map(({ orderItemId, totalCents }) => ({ orderItemId, newTotalCents: totalCents }))
    ),
  });
  return { ok: true, newTotalCents, unchanged, lineChanges, decision };
}

/**
 * The available lines of the order once `changes` apply, as decideAdjustment reads them: a changed
 * line takes its new total and keeps its total before the change, a line out of stock or removed is
 * left out. A line weighed again at 0 stays, at total 0: decideAdjustment leaves it out of the
 * tolerance base and it gives no room to the others.
 */
export function availableLinesAfter(
  lines: readonly MeasuredLine[],
  changes: ReadonlyArray<{ orderItemId: string; newTotalCents: number }>
): AdjustmentDecisionInput["lines"] {
  const newTotals = new Map(changes.map((change) => [change.orderItemId, change.newTotalCents]));
  return lines
    .filter((line) => line.available)
    .map((line) => ({
      estimatedPriceCents: line.estimatedPriceCents,
      totalCents: newTotals.get(line.id) ?? line.totalCents,
      previousTotalCents: line.totalCents,
    }));
}

/** Statuses whose new total is the order's; AUTO_VALIDATED: applied without an answer, older rows. */
const APPLIED: Record<AdjustmentStatus, boolean> = {
  PENDING: false,
  AUTO_APPROVED: true,
  APPROVED: true,
  REJECTED: false,
  AUTO_VALIDATED: true,
  ESCALATED: false,
};

/** Whether an adjustment in this status set the order's total. */
export function isAdjustmentApplied(status: AdjustmentStatus): boolean {
  return APPLIED[status];
}
