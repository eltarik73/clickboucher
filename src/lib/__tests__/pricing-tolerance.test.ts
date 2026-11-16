// @vitest-environment node
//
// The customer's weighing tolerance: what each choice allows, its base (what the lines still
// deliver of their estimate), the terms frozen on an order and how they are written. Whether a new
// price applies is in pricing-tolerance-decision.test.ts. Every expected amount is computed by hand
// in the comment beside it. Purity (siblings only, no clock) is guarded for every pricing module by
// pricing-line.test.ts.
import { describe, expect, it } from "vitest";
import {
  WEIGH_TOLERANCE_TERMS,
  estimatedTotalOf,
  formatToleranceTerms,
  frozenAllowanceCents,
  frozenToleranceOf,
  toleranceCents,
  type EstimatedLine,
  type FrozenTolerance,
  type WeighToleranceTerms,
} from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

const { STANDARD, EXTENDED } = WEIGH_TOLERANCE_TERMS;

describe("toleranceCents", () => {
  it.each([
    [0, 0],
    [3735, 186], // 3735 x 5 % = 186,75 -> 186 (floor, never in the butcher's favour)
    [19999, 999], // 999,95 -> 999
    [20000, 1000], // exactly the cap
    [20001, 1000], // 1000,05 -> capped at 10,00 €
    [100000, 1000], // 1 000 € order: 5 % = 50 €, capped at 10,00 €
  ])("STANDARD (5 %, 10,00 € at most) on %i cents -> %i cents", (estimated, expected) => {
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
  ])("EXTENDED (10 %, 20,00 € at most) on %i cents -> %i cents", (estimated, expected) => {
    expect(toleranceCents(EXTENDED, estimated)).toBe(expected);
  });

  it.each([-1, 12.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses an estimated total of %s with a RangeError",
    (estimated) => {
      expect(() => toleranceCents(STANDARD, estimated)).toThrow(RangeError);
    }
  );

  it.each<WeighToleranceTerms>([
    { rateBps: 2.5, capCents: 1000 },
    { rateBps: -500, capCents: 1000 },
    { rateBps: 500, capCents: -1 },
    { rateBps: 500, capCents: 10.5 },
  ])("refuses the terms %o with a RangeError", (terms) => {
    expect(() => toleranceCents(terms, 4000)).toThrow(RangeError);
  });
});

describe("estimatedTotalOf", () => {
  const line = (totalCents: number, estimatedPriceCents: number | null): EstimatedLine => ({
    totalCents,
    estimatedPriceCents,
  });

  it.each<[string, EstimatedLine[], number, number | null]>([
    ["sums the estimates minus the discount", [line(1000, 1000), line(800, 724)], 100, 1624],
    ["leaves out a line weighed at 0", [line(0, 2396), line(474, 451)], 0, 451],
    ["counts a line weighed at 1 g at its 2 cents", [line(2, 2396), line(474, 451)], 0, 453],
    ["counts a lighter line at its total", [line(1900, 2000), line(500, 500)], 0, 2400],
    ["never takes the discount below 0", [line(300, 300)], 500, 0],
    ["is 0 without line", [], 0, 0],
    ["has no total when a line has no estimate", [line(1000, 1000), line(1000, null)], 0, null],
    ["has no total when a line at 0 has no estimate", [line(0, null), line(500, 500)], 0, null],
  ])("%s", (_label, lines, discountCents, expected) => {
    expect(estimatedTotalOf(lines, discountCents)).toBe(expected);
  });

  it.each<[string, EstimatedLine[], number]>([
    ["an estimate", [line(1000, 10.5)], 0],
    ["a discount", [line(1000, 1000)], -1],
  ])("refuses %s that is not whole, non-negative cents", (_label, lines, discountCents) => {
    expect(() => estimatedTotalOf(lines, discountCents)).toThrow(RangeError);
  });
});

describe("frozenToleranceOf", () => {
  const columns = (rateBps: number | null, capCents: number | null, estimated: number | null) => ({
    weighToleranceRateBps: rateBps,
    weighToleranceCapCents: capCents,
    estimatedTotalCents: estimated,
  });

  it.each([
    [columns(500, 1000, 4000), { rateBps: 500, capCents: 1000, estimatedTotalCents: 4000 }],
    [columns(1000, 2000, 0), { rateBps: 1000, capCents: 2000, estimatedTotalCents: 0 }],
  ])("reads the three columns %o", (order, expected) => {
    expect(frozenToleranceOf(order)).toEqual(expected);
  });

  it.each([
    [null, 1000, 4000],
    [500, null, 4000],
    [500, 1000, null],
    [null, null, null],
  ])("has no tolerance unless the three columns are set (%s, %s, %s)", (rate, cap, estimated) => {
    expect(frozenToleranceOf(columns(rate, cap, estimated))).toBeNull();
  });
});

describe("frozenAllowanceCents", () => {
  it.each<[FrozenTolerance, number]>([
    [{ rateBps: 500, capCents: 1000, estimatedTotalCents: 3735 }, 186], // 186,75 -> 186
    [{ rateBps: 500, capCents: 1000, estimatedTotalCents: 451 }, 22], // 22,55 -> 22
    [{ rateBps: 1000, capCents: 2000, estimatedTotalCents: 100000 }, 2000], // 100 € capped
    [{ rateBps: 500, capCents: 1000, estimatedTotalCents: 0 }, 0],
  ])("allows %o: %i cents", (tolerance, expected) => {
    expect(frozenAllowanceCents(tolerance)).toBe(expected);
  });
});

describe("formatToleranceTerms", () => {
  // No-break spaces: before « % » and « € », and inside « au plus » (no line break at 375 px).
  const NB = " ";
  const written = (percent: string, cap: string) =>
    `${percent}${NB}% du total estimé, ${cap}${NB}€ au${NB}plus`;

  it.each([
    [STANDARD, written("5", "10,00")],
    [EXTENDED, written("10", "20,00")],
    [{ rateBps: 250, capCents: 500 }, written("2,5", "5,00")],
    [{ rateBps: 125, capCents: 1999 }, written("1,25", "19,99")],
    [{ rateBps: 1050, capCents: 5 }, written("10,5", "0,05")],
    [{ rateBps: 10000, capCents: 0 }, written("100", "0,00")],
  ])("%o -> %s", (terms, expected) => {
    expect(formatToleranceTerms(terms)).toBe(expected);
  });

  it("never leaves an ordinary space before a unit nor inside « au plus »", () => {
    const text = formatToleranceTerms(EXTENDED);
    expect(text).not.toMatch(/ [%€]| au plus/);
    expect(text.match(/ /g)).toHaveLength(3);
  });

  it.each([0, 5, 99, 100, 1000, 1999, 2000, 123456])(
    "writes a cap of %i cents like formatPrice, up to the no-break spaces",
    (capCents) => {
      const text = formatToleranceTerms({ rateBps: 500, capCents }).replace(/ /g, " ");
      expect(text).toBe(`5 % du total estimé, ${formatPrice(capCents)} au plus`);
    }
  );

  it("refuses a rate that is not a whole number of basis points", () => {
    expect(() => formatToleranceTerms({ rateBps: 12.5, capCents: 1000 })).toThrow(RangeError);
  });
});
