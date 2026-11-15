// @vitest-environment node
//
// The customer's weighing tolerance and the rule that decides whether a new price applies at once
// or needs the customer's answer (owner rule R3, decisions D-A1, D-A4, D-A12 of C1-PAIEMENT-A).
// Every expected amount is computed by hand in the comment beside it.
// Purity (siblings only, no clock) is guarded for every pricing module by pricing-line.test.ts.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_ANSWER_WINDOW_SECONDS,
  WEIGH_TOLERANCE_CHOICES,
  WEIGH_TOLERANCE_TERMS,
  decideAdjustment,
  formatToleranceTerms,
  frozenToleranceOf,
  toleranceCents,
  toleranceChoiceOf,
  type AdjustmentDecision,
  type AdjustmentDecisionInput,
  type AdjustmentKind,
  type FrozenTolerance,
  type WeighToleranceTerms,
} from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

const STANDARD = WEIGH_TOLERANCE_TERMS.STANDARD;
const EXTENDED = WEIGH_TOLERANCE_TERMS.EXTENDED;

describe("the two choices", () => {
  it("are STANDARD (5 %, 10,00 € at most) and EXTENDED (10 %, 20,00 € at most)", () => {
    expect(WEIGH_TOLERANCE_CHOICES).toEqual(["STANDARD", "EXTENDED"]);
    expect(STANDARD).toEqual({ rateBps: 500, capCents: 1000 });
    expect(EXTENDED).toEqual({ rateBps: 1000, capCents: 2000 });
  });

  it("cannot be changed at run time", () => {
    expect(Object.isFrozen(WEIGH_TOLERANCE_TERMS)).toBe(true);
    for (const choice of WEIGH_TOLERANCE_CHOICES) {
      expect(Object.isFrozen(WEIGH_TOLERANCE_TERMS[choice])).toBe(true);
    }
  });

  it("gives the customer 5 minutes to answer", () => {
    expect(ADJUSTMENT_ANSWER_WINDOW_SECONDS).toBe(300);
  });
});

describe("toleranceCents", () => {
  it.each([
    [0, 0],
    [3735, 186], // 3735 x 5 % = 186,75 -> 186 (floor, never in the butcher's favour)
    [19999, 999], // 999,95 -> 999
    [20000, 1000], // exactly the cap
    [20001, 1000], // 1000,05 -> capped at 10,00 €
    [100000, 1000], // 1 000 € order: 5 % = 50 €, capped at 10,00 €
  ])("STANDARD on %i cents -> %i cents", (estimated, expected) => {
    expect(toleranceCents(STANDARD, estimated)).toBe(expected);
  });

  it.each([
    [0, 0],
    [5000, 500],
    [3735, 373], // 3735 x 10 % = 373,5 -> 373
    [19999, 1999], // 1999,9 -> 1999
    [20000, 2000], // exactly the cap
    [20001, 2000], // 2000,1 -> capped at 20,00 €
    [100000, 2000], // 1 000 € order: 10 % = 100 €, capped at 20,00 €
  ])("EXTENDED on %i cents -> %i cents", (estimated, expected) => {
    expect(toleranceCents(EXTENDED, estimated)).toBe(expected);
  });

  it("refuses a total or terms that are not whole, non-negative numbers", () => {
    for (const bad of [-1, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => toleranceCents(STANDARD, bad)).toThrow(RangeError);
    }
    for (const terms of [
      { rateBps: 2.5, capCents: 1000 },
      { rateBps: -500, capCents: 1000 },
      { rateBps: 500, capCents: -1 },
      { rateBps: 500, capCents: 10.5 },
    ]) {
      expect(() => toleranceCents(terms, 4000)).toThrow(RangeError);
    }
  });
});

describe("frozenToleranceOf and toleranceChoiceOf", () => {
  const columns = (rateBps: number | null, capCents: number | null, estimated: number | null) => ({
    weighToleranceRateBps: rateBps,
    weighToleranceCapCents: capCents,
    estimatedTotalCents: estimated,
  });

  it.each(WEIGH_TOLERANCE_CHOICES)("round-trips %s through the order columns", (choice) => {
    const terms = WEIGH_TOLERANCE_TERMS[choice];
    const frozen = frozenToleranceOf(columns(terms.rateBps, terms.capCents, 4000));
    expect(frozen).toEqual({ ...terms, estimatedTotalCents: 4000 });
    expect(frozen === null ? null : toleranceChoiceOf(frozen)).toBe(choice);
    expect(toleranceChoiceOf(terms)).toBe(choice);
  });

  it("keeps an order whose estimated total is 0", () => {
    expect(frozenToleranceOf(columns(500, 1000, 0))).toEqual({
      rateBps: 500,
      capCents: 1000,
      estimatedTotalCents: 0,
    });
  });

  it.each([
    [null, 1000, 4000],
    [500, null, 4000],
    [500, 1000, null],
    [null, null, null],
  ])("has no tolerance unless the three columns are set (%s, %s, %s)", (rate, cap, estimated) => {
    expect(frozenToleranceOf(columns(rate, cap, estimated))).toBeNull();
  });

  it("names no choice for terms the customer cannot pick", () => {
    expect(toleranceChoiceOf({ rateBps: 500, capCents: 2000 })).toBeNull();
    expect(toleranceChoiceOf({ rateBps: 1000, capCents: 1000 })).toBeNull();
    expect(toleranceChoiceOf({ rateBps: 0, capCents: 0 })).toBeNull();
  });
});

describe("formatToleranceTerms", () => {
  it.each([
    [STANDARD, "5 % du total estimé, 10,00 € au plus"],
    [EXTENDED, "10 % du total estimé, 20,00 € au plus"],
    [{ rateBps: 250, capCents: 500 }, "2,5 % du total estimé, 5,00 € au plus"],
    [{ rateBps: 125, capCents: 1999 }, "1,25 % du total estimé, 19,99 € au plus"],
    [{ rateBps: 1050, capCents: 5 }, "10,5 % du total estimé, 0,05 € au plus"],
    [{ rateBps: 10000, capCents: 0 }, "100 % du total estimé, 0,00 € au plus"],
  ])("%o -> %s", (terms, expected) => {
    expect(formatToleranceTerms(terms)).toBe(expected);
  });

  it.each([0, 5, 99, 100, 1000, 1999, 2000, 123456])(
    "writes a cap of %i cents exactly like formatPrice",
    (capCents) => {
      const text = formatToleranceTerms({ rateBps: 500, capCents });
      expect(text).toBe(`5 % du total estimé, ${formatPrice(capCents)} au plus`);
    }
  );

  it("refuses a rate that is not a whole number of basis points", () => {
    expect(() => formatToleranceTerms({ rateBps: 12.5, capCents: 1000 })).toThrow(RangeError);
  });
});

const frozen = (terms: WeighToleranceTerms, estimatedTotalCents: number): FrozenTolerance => ({
  ...terms,
  estimatedTotalCents,
});
const S40 = frozen(STANDARD, 4000); // 5 % x 40,00 € = 2,00 €
const S60 = frozen(STANDARD, 6000); // 5 % x 60,00 € = 3,00 €

/** One available line after the change: its estimate at creation and its new total. */
const line = (estimatedCents: number | null, totalCents: number) => ({
  estimatedCents,
  totalCents,
});

function change(
  currentTotalCents: number,
  newTotalCents: number,
  lines: AdjustmentDecisionInput["lines"],
  tolerance: FrozenTolerance | null = S40,
  adjustmentType: AdjustmentKind = "WEIGHT"
): AdjustmentDecisionInput {
  return { adjustmentType, currentTotalCents, newTotalCents, tolerance, lines };
}

type Applied = Extract<AdjustmentDecision, { decision: "APPLY" }>;
type Asked = Extract<AdjustmentDecision, { decision: "ASK" }>;
const apply = (reason: Applied["reason"], t: number, c: number | null): Applied => ({
  decision: "APPLY",
  reason,
  toleranceCents: t,
  cumulatedIncreaseCents: c,
});
const ask = (reason: Asked["reason"], t: number, c: number | null): Asked => ({
  decision: "ASK",
  reason,
  toleranceCents: t,
  cumulatedIncreaseCents: c,
});

describe("decideAdjustment", () => {
  it.each([
    ["STANDARD on 40,00 €", S40, 200],
    ["STANDARD on 60,00 €", S60, 300],
    ["EXTENDED on 40,00 €", frozen(EXTENDED, 4000), 400], // 10 % x 40,00 € = 4,00 €
    ["STANDARD on 500,00 €", frozen(STANDARD, 50000), 1000], // 25,00 € capped at 10,00 €
    ["EXTENDED on 500,00 €", frozen(EXTENDED, 50000), 2000], // 50,00 € capped at 20,00 €
  ])(
    "%s: a weighing increase of exactly the tolerance applies, one cent more is asked",
    (_label, tolerance, allowance) => {
      const estimated = tolerance.estimatedTotalCents;
      const at = estimated + allowance;
      expect(decideAdjustment(change(estimated, at, [line(estimated, at)], tolerance))).toEqual(
        apply("WITHIN_TOLERANCE", allowance, allowance)
      );
      expect(
        decideAdjustment(change(estimated, at + 1, [line(estimated, at + 1)], tolerance))
      ).toEqual(ask("BEYOND_TOLERANCE", allowance, allowance + 1));
    }
  );

  it.each<[string, AdjustmentDecisionInput, AdjustmentDecision]>([
    [
      "a decrease applies at once",
      change(4000, 3800, [line(4000, 3800)]),
      apply("DECREASE", 200, -200),
    ],
    [
      "an unchanged total applies at once",
      change(4000, 4000, [line(4000, 4000)]),
      apply("DECREASE", 200, 0),
    ],
    [
      "the increase is cumulated since the order: +1,50 € applied, then +0,51 € is asked",
      change(4150, 4201, [line(4000, 4201)]),
      ask("BEYOND_TOLERANCE", 200, 201),
    ],
    [
      "a line under its estimate nets a line over it: -1,00 € and +4,00 € on 60,00 €",
      change(6000, 6300, [line(4000, 3900), line(2000, 2400)], S60),
      apply("WITHIN_TOLERANCE", 300, 300),
    ],
    [
      "the same netting one cent beyond is asked",
      change(6000, 6301, [line(4000, 3900), line(2000, 2401)], S60),
      ask("BEYOND_TOLERANCE", 300, 301),
    ],
    [
      "a removed line gives no room: B (20,00 €) gone, A +3,01 € is asked though 43,01 € < 60,00 €",
      change(4000, 4301, [line(4000, 4301)], S60),
      ask("BEYOND_TOLERANCE", 300, 301),
    ],
    [
      "a PRICE increase of one cent is asked",
      change(4000, 4001, [line(4000, 4001)], S40, "PRICE"),
      ask("NOT_WEIGHING", 200, 1),
    ],
    [
      "a MANUAL increase of one cent is asked",
      change(4000, 4001, [line(4000, 4001)], S40, "MANUAL"),
      ask("NOT_WEIGHING", 200, 1),
    ],
    [
      "a PRICE decrease applies at once",
      change(4000, 3500, [line(4000, 3500)], S40, "PRICE"),
      apply("DECREASE", 200, -500),
    ],
    [
      "a MANUAL decrease applies at once",
      change(4000, 3500, [line(4000, 3500)], S40, "MANUAL"),
      apply("DECREASE", 200, -500),
    ],
    [
      "an order without frozen tolerance (created before this rule) is asked for one cent",
      change(4000, 4001, [line(4000, 4001)], null),
      ask("NO_TOLERANCE", 0, 1),
    ],
    [
      "an order without frozen tolerance still takes a decrease",
      change(4000, 3900, [line(4000, 3900)], null),
      apply("DECREASE", 0, -100),
    ],
    [
      "a line without estimate cannot be measured: asked",
      change(4000, 4001, [line(3000, 3000), line(null, 1001)]),
      ask("NO_TOLERANCE", 200, null),
    ],
  ])("%s", (_label, input, expected) => {
    expect(decideAdjustment(input)).toEqual(expected);
  });

  it("refuses amounts that are not whole, non-negative cents", () => {
    const lines = [line(4000, 4000)];
    expect(() => decideAdjustment(change(4000, -1, lines))).toThrow(RangeError);
    expect(() => decideAdjustment(change(40.5, 4000, lines))).toThrow(RangeError);
    expect(() => decideAdjustment(change(4000, 4100, [line(4000, 4100.5)]))).toThrow(RangeError);
    expect(() => decideAdjustment(change(4000, 4100, [line(-1, 4100)]))).toThrow(RangeError);
  });
});
