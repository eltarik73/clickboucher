// src/lib/pricing/tolerance.ts — the customer's weighing tolerance, and whether a new price set
// by the butcher applies at once or needs the customer's answer.
//
// The server freezes the rate and cap of the customer's choice on the order, with the estimated
// total; when the customer accepts a new composition (a line out of stock removed or replaced), the
// estimated total is frozen again from the lines he still gets (estimatedTotalOf). A decrease that
// raises no line always applies; a change that raises a line applies without asking only for a
// weighing whose increase cumulated since the order, measured against the estimates of the lines
// still delivered, stays within the tolerance: a line out of stock, removed or weighed again at 0
// gives no room, and small steps cannot add up past it.
//
// Pure and client-safe: no database, no clock, no I/O. Cents and basis points (500 = 5 %).
import { assertCents } from "./line";
import { computeOrderTotals } from "./totals";

export const WEIGH_TOLERANCE_CHOICES = ["STANDARD", "EXTENDED"] as const;
export type WeighToleranceChoice = (typeof WEIGH_TOLERANCE_CHOICES)[number];

export interface WeighToleranceTerms {
  rateBps: number;
  capCents: number;
}

/** STANDARD: 5 % of the estimated total, 10,00 € at most. EXTENDED: 10 %, 20,00 € at most. */
export const WEIGH_TOLERANCE_TERMS: Readonly<Record<WeighToleranceChoice, WeighToleranceTerms>> =
  Object.freeze({
    STANDARD: Object.freeze({ rateBps: 500, capCents: 1000 }),
    EXTENDED: Object.freeze({ rateBps: 1000, capCents: 2000 }),
  });

/** The terms frozen on an order, with the estimated total they apply to. */
export interface FrozenTolerance extends WeighToleranceTerms {
  estimatedTotalCents: number;
}

/** Seconds the customer has to answer a price adjustment; silence is a refusal. */
export const ADJUSTMENT_ANSWER_WINDOW_SECONDS = 300;

/** The dates of a price adjustment that its answer window depends on. */
export interface AdjustmentAnswerDates {
  answerBy: Date | null;
  createdAt: Date;
}

/** When the customer's answer window ends: answerBy, or createdAt + the window on older rows. */
export function adjustmentAnswerDeadline(adjustment: AdjustmentAnswerDates): Date {
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
  adjustment: (AdjustmentAnswerDates & { status: string }) | null,
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

/**
 * The estimated total of a composition: the estimates of its lines (their totals when the customer
 * accepted them) minus the stored discount, summed like Order.totalCents (computeOrderTotals);
 * null when a line has no estimate, which leaves the order without tolerance.
 */
export function estimatedTotalOf(
  estimatesCents: ReadonlyArray<number | null>,
  discountCents: number
): number | null {
  const known = estimatesCents.filter((estimate): estimate is number => estimate !== null);
  if (known.length !== estimatesCents.length) return null;
  return computeOrderTotals({ lineTotalsCents: known, discountCents, serviceFeeCents: 0 })
    .totalCents;
}

/** The tolerance frozen on an order; null unless the three columns are set (older orders). */
export function frozenToleranceOf(order: {
  weighToleranceRateBps: number | null;
  weighToleranceCapCents: number | null;
  estimatedTotalCents: number | null;
}): FrozenTolerance | null {
  const { weighToleranceRateBps: rateBps, weighToleranceCapCents: capCents } = order;
  if (rateBps === null || capCents === null || order.estimatedTotalCents === null) return null;
  return { rateBps, capCents, estimatedTotalCents: order.estimatedTotalCents };
}

/** The choice these terms come from, or null when no choice has them. */
export function toleranceChoiceOf(terms: WeighToleranceTerms): WeighToleranceChoice | null {
  const match = WEIGH_TOLERANCE_CHOICES.find(
    (choice) =>
      WEIGH_TOLERANCE_TERMS[choice].rateBps === terms.rateBps &&
      WEIGH_TOLERANCE_TERMS[choice].capCents === terms.capCents
  );
  return match ?? null;
}

/** A whole number of hundredths with a decimal comma and two decimals: 1000 -> "10,00". */
function hundredths(value: number): string {
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

/** No-break space: a number stays with its unit, « au plus » stays on one line. */
const NBSP = "\u00a0";

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

export type AdjustmentKind = "WEIGHT" | "PRICE" | "MANUAL";

export interface AdjustmentDecisionInput {
  adjustmentType: AdjustmentKind;
  currentTotalCents: number;
  newTotalCents: number;
  tolerance: FrozenTolerance | null;
  /** Available lines AFTER the change, with their total before it. */
  lines: ReadonlyArray<{
    estimatedCents: number | null;
    totalCents: number;
    previousTotalCents: number;
  }>;
}

/**
 * toleranceCents: 0 without tolerance. cumulatedIncreaseCents: null when a delivered line has no
 * estimate.
 */
interface Measured {
  toleranceCents: number;
  cumulatedIncreaseCents: number | null;
}

export type AdjustmentDecision =
  | ({ decision: "APPLY"; reason: "DECREASE" | "WITHIN_TOLERANCE" } & Measured)
  | ({ decision: "ASK"; reason: "NOT_WEIGHING" | "NO_TOLERANCE" | "BEYOND_TOLERANCE" } & Measured);

/**
 * Sum of (total - estimate) over the lines still delivered, possibly negative; null when one of
 * them has no estimate. A line at 0 after the change (weighed again at 0: not delivered) is left
 * out like a line out of stock: it gives no room to the others.
 */
function cumulatedIncrease(lines: AdjustmentDecisionInput["lines"]): number | null {
  let cumulated = 0;
  for (const { estimatedCents, totalCents, previousTotalCents } of lines) {
    assertCents("totalCents", totalCents);
    assertCents("previousTotalCents", previousTotalCents);
    if (estimatedCents !== null) assertCents("estimatedCents", estimatedCents);
    if (totalCents === 0) continue;
    if (estimatedCents === null) return null;
    cumulated += totalCents - estimatedCents;
  }
  return cumulated;
}

/**
 * APPLY at once, or ASK for the customer's explicit yes. A change that keeps or lowers the total
 * without raising any line applies (DECREASE), even after an increase the customer accepted.
 * A change that raises a line is an increase on that line, even when another line goes down or
 * to 0 and the total with it: it applies without asking only for a weighing, on an order with a
 * frozen tolerance, when every delivered line has its estimate and the cumulated increase stays
 * within the tolerance. Throws RangeError on amounts that are not whole, non-negative cents.
 */
export function decideAdjustment(input: AdjustmentDecisionInput): AdjustmentDecision {
  assertCents("currentTotalCents", input.currentTotalCents);
  assertCents("newTotalCents", input.newTotalCents);
  const { tolerance } = input;
  const allowance =
    tolerance === null ? 0 : toleranceCents(tolerance, tolerance.estimatedTotalCents);
  const cumulated = cumulatedIncrease(input.lines);
  const measured: Measured = { toleranceCents: allowance, cumulatedIncreaseCents: cumulated };

  const raisesALine = input.lines.some((line) => line.totalCents > line.previousTotalCents);
  if (input.newTotalCents <= input.currentTotalCents && !raisesALine) {
    return { decision: "APPLY", reason: "DECREASE", ...measured };
  }
  if (input.adjustmentType !== "WEIGHT") {
    return { decision: "ASK", reason: "NOT_WEIGHING", ...measured };
  }
  if (tolerance === null || cumulated === null) {
    return { decision: "ASK", reason: "NO_TOLERANCE", ...measured };
  }
  return cumulated <= allowance
    ? { decision: "APPLY", reason: "WITHIN_TOLERANCE", ...measured }
    : { decision: "ASK", reason: "BEYOND_TOLERANCE", ...measured };
}
