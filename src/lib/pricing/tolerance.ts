// src/lib/pricing/tolerance.ts — the customer's weighing tolerance, and whether a new price set
// by the butcher applies at once or needs the customer's answer.
//
// At checkout the server freezes on the order the rate and cap of the customer's choice. When the
// butcher weighs again, two rules measure the change:
// - the tolerance is the rate of the estimate of the lines still delivered (estimatedTotalOf), up
//   to the cap: a line out of stock, removed or weighed at 0 shrinks it;
// - the increase is measured line by line, the sum over those lines of what each costs above its
//   own estimate: a lighter line never gives room to a heavier one, and small steps cannot add up
//   past the tolerance.
// A change that keeps or lowers the total and raises no line always applies.
//
// Pure and client-safe: no database, no clock, no I/O. Cents and basis points (500 = 5 %).
import type { AdjustmentStatus, AdjustmentType } from "@prisma/client";
import { assertCents } from "./line";
import { computeOrderTotals } from "./totals";

export const WEIGH_TOLERANCE_CHOICES = ["STANDARD", "EXTENDED"] as const;
export type WeighToleranceChoice = (typeof WEIGH_TOLERANCE_CHOICES)[number];

export interface WeighToleranceTerms {
  rateBps: number;
  capCents: number;
}

/** STANDARD: 5 % of the estimated total, 10,00 € at most. EXTENDED: 10 %, 20,00 € at most. */
export const WEIGH_TOLERANCE_TERMS = {
  STANDARD: { rateBps: 500, capCents: 1000 },
  EXTENDED: { rateBps: 1000, capCents: 2000 },
} as const satisfies Record<WeighToleranceChoice, WeighToleranceTerms>;

/** The tolerance columns of an order; null on orders created without one. */
export interface FrozenToleranceColumns {
  weighToleranceRateBps: number | null;
  weighToleranceCapCents: number | null;
  estimatedTotalCents: number | null;
}

/** The terms frozen on an order, with the estimated total they apply to. */
export interface FrozenTolerance extends WeighToleranceTerms {
  estimatedTotalCents: number;
}

/** Seconds the customer has to answer a price adjustment; silence is a refusal. */
export const ADJUSTMENT_ANSWER_WINDOW_SECONDS = 300;

/** When the customer's answer window ends: answerBy, or createdAt + the window on older rows. */
export function adjustmentAnswerDeadline(adjustment: {
  answerBy: Date | null;
  createdAt: Date;
}): Date {
  return (
    adjustment.answerBy ??
    new Date(adjustment.createdAt.getTime() + ADJUSTMENT_ANSWER_WINDOW_SECONDS * 1000)
  );
}

/**
 * A pending adjustment whose answer window has passed at `now`, to be closed as unanswered. The
 * same rule as expiredAdjustmentWhere (src/lib/services/orders/adjustment-closure.ts), which
 * writes it in SQL: a reader that already holds the row decides without a query.
 */
export function isAdjustmentAnswerDue(
  adjustment: { answerBy: Date | null; createdAt: Date; status: AdjustmentStatus } | null,
  now: Date
): boolean {
  if (adjustment === null || adjustment.status !== "PENDING") return false;
  return adjustmentAnswerDeadline(adjustment).getTime() <= now.getTime();
}

const BASIS_POINTS = 10_000;

function assertTerms(terms: WeighToleranceTerms): void {
  if (!Number.isSafeInteger(terms.rateBps) || terms.rateBps < 0) {
    throw new RangeError(`rateBps must be a non-negative integer, received ${terms.rateBps}`);
  }
  assertCents("capCents", terms.capCents);
}

/**
 * min(rate x estimated total, cap) in cents, the product rounded down: never in the butcher's
 * favour. Throws RangeError on terms or a total that are not whole and non-negative.
 */
export function toleranceCents(terms: WeighToleranceTerms, estimatedTotalCents: number): number {
  assertTerms(terms);
  assertCents("estimatedTotalCents", estimatedTotalCents);
  const proportional = Math.floor((terms.rateBps * estimatedTotalCents) / BASIS_POINTS);
  return Math.min(proportional, terms.capCents);
}

/** A line of an order as the tolerance reads it (OrderItem columns). */
export interface EstimatedLine {
  totalCents: number;
  /** Line total at checkout, or when the customer accepted the line; null on older lines. */
  estimatedPriceCents: number | null;
}

/**
 * The base of the tolerance: the estimates of the lines still delivered (total above 0) among the
 * available `lines`, minus the stored discount, summed like Order.totalCents (computeOrderTotals).
 * Null when one of `lines` has no estimate, which leaves the order without tolerance.
 */
export function estimatedTotalOf(
  lines: ReadonlyArray<EstimatedLine>,
  discountCents: number
): number | null {
  const deliveredEstimates: number[] = [];
  for (const line of lines) {
    if (line.estimatedPriceCents === null) return null;
    if (line.totalCents > 0) deliveredEstimates.push(line.estimatedPriceCents);
  }
  return computeOrderTotals({
    lineTotalsCents: deliveredEstimates,
    discountCents,
    serviceFeeCents: 0,
  }).totalCents;
}

/** The tolerance frozen on an order; null unless the three columns are set (older orders). */
export function frozenToleranceOf(order: FrozenToleranceColumns): FrozenTolerance | null {
  const { weighToleranceRateBps: rateBps, weighToleranceCapCents: capCents } = order;
  if (rateBps === null || capCents === null || order.estimatedTotalCents === null) return null;
  return { rateBps, capCents, estimatedTotalCents: order.estimatedTotalCents };
}

/** The amount a frozen tolerance allows: what the ticket and the customer's note print. */
export function frozenAllowanceCents(tolerance: FrozenTolerance): number {
  return toleranceCents(tolerance, tolerance.estimatedTotalCents);
}

/** A whole number of hundredths with a decimal comma and two decimals: 1000 -> "10,00". */
function hundredths(value: number): string {
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

/** No-break space: a number stays with its unit, « au plus » stays on one line. */
const NBSP = " ";

/**
 * "5 % du total estimé, 10,00 € au plus", with a no-break space before « % » and « € » and inside
 * « au plus »; the cap is written like formatPrice of src/lib/utils, up to those spaces.
 */
export function formatToleranceTerms(terms: WeighToleranceTerms): string {
  assertTerms(terms);
  const percent = hundredths(terms.rateBps).replace(/,?0+$/, "");
  const cap = hundredths(terms.capCents);
  return `${percent}${NBSP}% du total estimé, ${cap}${NBSP}€ au${NBSP}plus`;
}

export interface AdjustmentDecisionInput {
  adjustmentType: AdjustmentType;
  currentTotalCents: number;
  newTotalCents: number;
  /** Rate and cap frozen on the order (frozenToleranceOf(order)); null without tolerance. */
  tolerance: WeighToleranceTerms | null;
  /** Discount stored on the order, subtracted from the base of the tolerance. */
  discountCents: number;
  /** Available lines AFTER the change, with their total before it. */
  lines: ReadonlyArray<EstimatedLine & { previousTotalCents: number }>;
}

export type AdjustmentDecision = (
  | { decision: "APPLY"; reason: "DECREASE" | "WITHIN_TOLERANCE" }
  | { decision: "ASK"; reason: "NOT_WEIGHING" | "NO_TOLERANCE" | "BEYOND_TOLERANCE" }
) & {
  /** What the tolerance allows on the base; 0 without tolerance or without base. */
  toleranceCents: number;
  /** Sum over the lines of what each costs above its estimate; null when one has no estimate. */
  cumulatedIncreaseCents: number | null;
  /** The base after the change (estimatedTotalOf); null without tolerance or estimate. */
  estimatedTotalCents: number | null;
};

/** Sum of max(0, total - estimate) over the lines; null when one of them has no estimate. */
function cumulatedIncrease(lines: AdjustmentDecisionInput["lines"]): number | null {
  let cumulated = 0;
  for (const { estimatedPriceCents, totalCents } of lines) {
    if (estimatedPriceCents === null) return null;
    cumulated += Math.max(0, totalCents - estimatedPriceCents);
  }
  return cumulated;
}

function assertLineCents(line: AdjustmentDecisionInput["lines"][number]): void {
  assertCents("totalCents", line.totalCents);
  assertCents("previousTotalCents", line.previousTotalCents);
  if (line.estimatedPriceCents !== null)
    assertCents("estimatedPriceCents", line.estimatedPriceCents);
}

/**
 * APPLY at once, or ASK for the customer's explicit yes. A change that keeps or lowers the total
 * without raising any line applies (DECREASE), even after an increase the customer accepted.
 * A change that raises a line applies without asking only for a weighing, on an order with a
 * frozen tolerance, when every delivered line has its estimate and the increase measured line by
 * line stays within the tolerance of the lines still delivered. Throws RangeError on amounts that
 * are not whole, non-negative cents.
 */
export function decideAdjustment(input: AdjustmentDecisionInput): AdjustmentDecision {
  assertCents("currentTotalCents", input.currentTotalCents);
  assertCents("newTotalCents", input.newTotalCents);
  assertCents("discountCents", input.discountCents);
  input.lines.forEach(assertLineCents);
  const { tolerance, lines } = input;
  const base = tolerance === null ? null : estimatedTotalOf(lines, input.discountCents);
  const allowance = tolerance === null || base === null ? 0 : toleranceCents(tolerance, base);
  const cumulated = cumulatedIncrease(lines);
  const measured = {
    toleranceCents: allowance,
    cumulatedIncreaseCents: cumulated,
    estimatedTotalCents: base,
  };

  const raisesALine = lines.some((line) => line.totalCents > line.previousTotalCents);
  if (input.newTotalCents <= input.currentTotalCents && !raisesALine) {
    return { decision: "APPLY", reason: "DECREASE", ...measured };
  }
  if (input.adjustmentType !== "WEIGHT") {
    return { decision: "ASK", reason: "NOT_WEIGHING", ...measured };
  }
  if (base === null || cumulated === null) {
    return { decision: "ASK", reason: "NO_TOLERANCE", ...measured };
  }
  return cumulated <= allowance
    ? { decision: "APPLY", reason: "WITHIN_TOLERANCE", ...measured }
    : { decision: "ASK", reason: "BEYOND_TOLERANCE", ...measured };
}
