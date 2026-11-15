// @vitest-environment node
//
// Whether a new price set by the butcher applies at once or needs the customer's answer. The
// tolerance is the rate of the estimate of the lines still delivered, up to the cap; the increase
// is the sum over those lines of what each costs above its own estimate. Every expected amount is
// computed by hand in the comment or the title beside it.
import { describe, expect, it } from "vitest";
import {
  WEIGH_TOLERANCE_TERMS,
  decideAdjustment,
  type AdjustmentDecision,
  type AdjustmentDecisionInput,
} from "@/lib/pricing/tolerance";

const { STANDARD, EXTENDED } = WEIGH_TOLERANCE_TERMS;

type Line = AdjustmentDecisionInput["lines"][number];

/** A line after the change: its estimate, its new total, its total before (default: estimate). */
function line(estimatedPriceCents: number | null, totalCents: number, previous?: number): Line {
  return {
    estimatedPriceCents,
    totalCents,
    previousTotalCents: previous ?? estimatedPriceCents ?? totalCents,
  };
}

/** A weighing on an order with the STANDARD tolerance and no discount. */
function weighing(
  currentTotalCents: number,
  newTotalCents: number,
  lines: Line[]
): AdjustmentDecisionInput {
  return {
    adjustmentType: "WEIGHT",
    currentTotalCents,
    newTotalCents,
    tolerance: STANDARD,
    discountCents: 0,
    lines,
  };
}

type Applied = Extract<AdjustmentDecision, { decision: "APPLY" }>;
type Asked = Extract<AdjustmentDecision, { decision: "ASK" }>;
/** The decision with its tolerance, its increase measured line by line and its base, in cents. */
const apply = (
  reason: Applied["reason"],
  t: number,
  c: number | null,
  e: number | null
): Applied => ({
  decision: "APPLY",
  reason,
  toleranceCents: t,
  cumulatedIncreaseCents: c,
  estimatedTotalCents: e,
});
const ask = (reason: Asked["reason"], t: number, c: number | null, e: number | null): Asked => ({
  decision: "ASK",
  reason,
  toleranceCents: t,
  cumulatedIncreaseCents: c,
  estimatedTotalCents: e,
});

describe("decideAdjustment at the edge of the tolerance", () => {
  it.each([
    ["STANDARD on 40,00 €", STANDARD, 4000, 200], // 5 % x 40,00 € = 2,00 €
    ["STANDARD on 60,00 €", STANDARD, 6000, 300], // 5 % x 60,00 € = 3,00 €
    ["EXTENDED on 40,00 €", EXTENDED, 4000, 400], // 10 % x 40,00 € = 4,00 €
    ["STANDARD on 500,00 €", STANDARD, 50000, 1000], // 25,00 € capped at 10,00 €
    ["EXTENDED on 500,00 €", EXTENDED, 50000, 2000], // 50,00 € capped at 20,00 €
  ])(
    "%s: a weighing increase of exactly the tolerance applies, one cent more is asked",
    (_label, tolerance, estimated, allowance) => {
      const at = estimated + allowance;
      const within = { ...weighing(estimated, at, [line(estimated, at)]), tolerance };
      const beyond = { ...weighing(estimated, at + 1, [line(estimated, at + 1)]), tolerance };

      expect(decideAdjustment(within)).toEqual(
        apply("WITHIN_TOLERANCE", allowance, allowance, estimated)
      );
      expect(decideAdjustment(beyond)).toEqual(
        ask("BEYOND_TOLERANCE", allowance, allowance + 1, estimated)
      );
    }
  );
});

// Côte de bœuf 1 kg at 23,96 €/kg (estimate 2396) and tripes 500 g at 9,02 €/kg (estimate 451).
const COTE = 2396;
const TRIPES = 451;

describe("decideAdjustment", () => {
  it.each<[string, AdjustmentDecisionInput, AdjustmentDecision]>([
    [
      "a decrease applies at once",
      weighing(4000, 3800, [line(4000, 3800)]),
      apply("DECREASE", 200, 0, 4000),
    ],
    [
      "an unchanged total applies at once",
      weighing(4000, 4000, [line(4000, 4000)]),
      apply("DECREASE", 200, 0, 4000),
    ],
    [
      "the increase counts from the estimate: +1,50 € already applied, +0,51 € more is asked",
      weighing(4150, 4201, [line(4000, 4201, 4150)]),
      ask("BEYOND_TOLERANCE", 200, 201, 4000),
    ],
    [
      "a lighter line gives no room to a heavier one: -1,00 € and +4,00 € on 60,00 € is asked",
      weighing(6000, 6300, [line(4000, 3900), line(2000, 2400)]),
      ask("BEYOND_TOLERANCE", 300, 400, 6000), // 0 + 400 > 5 % x 60,00 €
    ],
    [
      "the heavier line alone is measured: -1,00 € and +0,50 € on 25,00 € applies",
      weighing(2500, 2450, [line(2000, 1900), line(500, 550)]),
      apply("WITHIN_TOLERANCE", 125, 50, 2500), // 0 + 50 <= 5 % x 25,00 € = 1,25 €
    ],
    [
      "a line weighed to 1 g gives no room: côte 23,96 € -> 0,02 €, tripes 4,51 € -> 28,41 €",
      weighing(COTE + TRIPES, 2843, [line(COTE, 2), line(TRIPES, 2841)]),
      ask("BEYOND_TOLERANCE", 142, 2390, 2847), // 5 % x 28,47 € = 1,4235 € -> 142
    ],
    [
      "zeroed and inflated in one change: asked on the line still delivered, though the total drops",
      weighing(2500, 2400, [line(2000, 0), line(500, 2400)]),
      ask("BEYOND_TOLERANCE", 25, 1900, 500), // base 5,00 €: 5 % = 0,25 €
    ],
    [
      "a line zeroed alone is a decrease, and the base shrinks to the line still delivered",
      weighing(2500, 500, [line(2000, 0), line(500, 500)]),
      apply("DECREASE", 25, 0, 500),
    ],
    [
      "after the côte weighed at 0, tripes + 0,23 € is asked: 5 % of 4,51 € = 0,22 €",
      weighing(TRIPES, 474, [line(COTE, 0, 0), line(TRIPES, 474)]),
      ask("BEYOND_TOLERANCE", 22, 23, 451),
    ],
    [
      "after the côte weighed at 0, tripes + 0,22 € applies",
      weighing(TRIPES, 473, [line(COTE, 0, 0), line(TRIPES, 473)]),
      apply("WITHIN_TOLERANCE", 22, 22, 451),
    ],
    [
      "a line back from 0 counts again in the base: côte 0 -> 25,00 €, 1,04 € over its estimate",
      weighing(TRIPES, 2951, [line(COTE, 2500, 0), line(TRIPES, 451)]),
      apply("WITHIN_TOLERANCE", 142, 104, 2847),
    ],
    [
      "the base is the estimate minus the discount: +2,00 € on 40,00 € less 5,00 € is asked",
      { ...weighing(3500, 3700, [line(4000, 4200)]), discountCents: 500 },
      ask("BEYOND_TOLERANCE", 175, 200, 3500), // 5 % x 35,00 € = 1,75 €
    ],
    [
      "a decrease raising no line applies, even beyond the tolerance after an accepted increase",
      weighing(2300, 2200, [line(1000, 1300, 1300), line(1000, 900, 1000)]),
      apply("DECREASE", 100, 300, 2000),
    ],
    [
      "a PRICE increase of one cent is asked",
      { ...weighing(4000, 4001, [line(4000, 4001)]), adjustmentType: "PRICE" },
      ask("NOT_WEIGHING", 200, 1, 4000),
    ],
    [
      "a new unit price raising a line is asked, though the total goes down",
      { ...weighing(2500, 2400, [line(2000, 1500), line(500, 900)]), adjustmentType: "PRICE" },
      ask("NOT_WEIGHING", 125, 400, 2500),
    ],
    [
      "a MANUAL total one cent higher is asked",
      { ...weighing(4000, 4001, [line(4000, 4000)]), adjustmentType: "MANUAL" },
      ask("NOT_WEIGHING", 200, 0, 4000),
    ],
    [
      "a PRICE decrease applies at once",
      { ...weighing(4000, 3500, [line(4000, 3500)]), adjustmentType: "PRICE" },
      apply("DECREASE", 200, 0, 4000),
    ],
    [
      "a MANUAL decrease applies at once",
      { ...weighing(4000, 3500, [line(4000, 4000)]), adjustmentType: "MANUAL" },
      apply("DECREASE", 200, 0, 4000),
    ],
    [
      "an order without frozen tolerance is asked for one cent",
      { ...weighing(4000, 4001, [line(4000, 4001)]), tolerance: null },
      ask("NO_TOLERANCE", 0, 1, null),
    ],
    [
      "an order without frozen tolerance still takes a decrease",
      { ...weighing(4000, 3900, [line(4000, 3900)]), tolerance: null },
      apply("DECREASE", 0, 0, null),
    ],
    [
      "an order without tolerance: zeroed and inflated is asked",
      { ...weighing(2500, 600, [line(2000, 0), line(500, 600)]), tolerance: null },
      ask("NO_TOLERANCE", 0, 100, null),
    ],
    [
      "a line without estimate leaves nothing to measure: asked",
      weighing(4000, 4001, [line(3000, 3000), line(null, 1001, 1000)]),
      ask("NO_TOLERANCE", 0, null, null),
    ],
    [
      "a line without estimate weighed at 0 still leaves nothing to measure: asked",
      weighing(1300, 1050, [line(null, 0, 300), line(1000, 1050)]),
      ask("NO_TOLERANCE", 0, null, null),
    ],
    [
      "a decrease raising no line applies on an order without tolerance nor estimates",
      { ...weighing(1000, 900, [line(null, 900, 1000)]), tolerance: null },
      apply("DECREASE", 0, null, null),
    ],
  ])("%s", (_label, input, expected) => {
    expect(decideAdjustment(input)).toEqual(expected);
  });

  it.each<[string, AdjustmentDecisionInput]>([
    ["a negative new total", weighing(4000, -1, [line(4000, 4000)])],
    ["a fractional current total", weighing(40.5, 4000, [line(4000, 4000)])],
    ["a fractional line total", weighing(4000, 4100, [line(4000, 4100.5)])],
    ["a negative estimate", weighing(4000, 4100, [line(-1, 4100, 4000)])],
    ["a fractional total before", weighing(4000, 4100, [line(4000, 4100, 0.5)])],
    ["a negative discount", { ...weighing(4000, 4100, [line(4000, 4100)]), discountCents: -1 }],
  ])("refuses %s with a RangeError", (_label, input) => {
    expect(() => decideAdjustment(input)).toThrow(RangeError);
  });
});
