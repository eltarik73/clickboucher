// @vitest-environment node
// Lignes mesurées par la marge de pesée après un ajustement : une ligne changée prend son nouveau
// total et garde celui d'avant ; une ligne en rupture, retirée ou repesée à 0 ne donne aucune marge
// aux autres. Une baisse qui n'augmente aucune ligne s'applique toujours ; un changement qui
// augmente une ligne est une hausse, même si le total baisse. Total estimé d'une composition.
import { describe, expect, it } from "vitest";
import { availableLinesAfter, type MeasuredLine } from "@/lib/pricing/adjustment";
import {
  WEIGH_TOLERANCE_TERMS,
  decideAdjustment,
  estimatedTotalOf,
  type AdjustmentDecisionInput,
  type FrozenTolerance,
} from "@/lib/pricing/tolerance";

const LINES: MeasuredLine[] = [
  { id: "a", available: true, totalCents: 2000, estimatedPriceCents: 2000 },
  { id: "b", available: false, totalCents: 2000, estimatedPriceCents: 2000 },
  { id: "c", available: true, totalCents: 1000, estimatedPriceCents: null },
];

describe("availableLinesAfter", () => {
  it("keeps the available lines, a changed one at its new total, a line weighed at 0 included", () => {
    expect(availableLinesAfter(LINES, [{ orderItemId: "a", newTotalCents: 2150 }])).toEqual([
      { estimatedCents: 2000, totalCents: 2150, previousTotalCents: 2000 },
      { estimatedCents: null, totalCents: 1000, previousTotalCents: 1000 },
    ]);
    expect(availableLinesAfter(LINES, [{ orderItemId: "c", newTotalCents: 0 }])).toEqual([
      { estimatedCents: 2000, totalCents: 2000, previousTotalCents: 2000 },
      { estimatedCents: null, totalCents: 0, previousTotalCents: 1000 },
    ]);
  });

  it("gives decideAdjustment no room from a line out of stock", () => {
    const lines = availableLinesAfter(LINES.slice(0, 2), [
      { orderItemId: "a", newTotalCents: 2201 },
    ]);

    // Marge sur 40,00 € estimés : 2,00 € ; la seule ligne restante a pris 2,01 €.
    expect(
      decideAdjustment({
        adjustmentType: "WEIGHT",
        currentTotalCents: 2000,
        newTotalCents: 2201,
        tolerance: { ...WEIGH_TOLERANCE_TERMS.STANDARD, estimatedTotalCents: 4000 },
        lines,
      })
    ).toMatchObject({ decision: "ASK", reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 201 });
  });
});

const S25: FrozenTolerance = { ...WEIGH_TOLERANCE_TERMS.STANDARD, estimatedTotalCents: 2500 }; // 1,25 €
const S20: FrozenTolerance = { ...WEIGH_TOLERANCE_TERMS.STANDARD, estimatedTotalCents: 2000 }; // 1,00 €

/** A line after the change: [estimate, new total, total before]. */
type Row = [number | null, number, number];

function decide(
  currentTotalCents: number,
  newTotalCents: number,
  rows: Row[],
  tolerance: FrozenTolerance | null,
  adjustmentType: AdjustmentDecisionInput["adjustmentType"] = "WEIGHT"
) {
  const lines = rows.map(([estimatedCents, totalCents, previousTotalCents]) => ({
    estimatedCents,
    totalCents,
    previousTotalCents,
  }));
  return decideAdjustment({ adjustmentType, currentTotalCents, newTotalCents, tolerance, lines });
}

describe("decideAdjustment: a line at 0 gives no room, a raised line is an increase", () => {
  it.each<[string, ReturnType<typeof decide>, Record<string, unknown>]>([
    [
      // Côte 20,00 € repesée à 0 et tripes 5,00 € -> 24,00 € : le total baisse de 1,00 €.
      "zeroed and inflated in one change: asked, though the total goes down",
      decide(
        2500,
        2400,
        [
          [2000, 0, 2000],
          [500, 2400, 500],
        ],
        S25
      ),
      {
        decision: "ASK",
        reason: "BEYOND_TOLERANCE",
        toleranceCents: 125,
        cumulatedIncreaseCents: 1900,
      },
    ],
    [
      "a line zeroed alone is a decrease",
      decide(
        2500,
        500,
        [
          [2000, 0, 2000],
          [500, 500, 500],
        ],
        S25
      ),
      { decision: "APPLY", reason: "DECREASE", cumulatedIncreaseCents: 0 },
    ],
    [
      "then the other line inflated is measured against its own estimate only",
      decide(
        500,
        700,
        [
          [2000, 0, 0],
          [500, 700, 500],
        ],
        S25
      ),
      { decision: "ASK", reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 200 },
    ],
    [
      "a line zeroed without estimate is not measured: the other one still is",
      decide(
        1300,
        1050,
        [
          [null, 0, 300],
          [1000, 1050, 1000],
        ],
        S20
      ),
      { decision: "APPLY", reason: "WITHIN_TOLERANCE", cumulatedIncreaseCents: 50 },
    ],
    [
      "a lighter line nets a heavier one within the tolerance: applied as weighed",
      decide(
        2500,
        2450,
        [
          [2000, 1900, 2000],
          [500, 550, 500],
        ],
        S25
      ),
      { decision: "APPLY", reason: "WITHIN_TOLERANCE", cumulatedIncreaseCents: -50 },
    ],
    [
      // Le client a accepté +3,00 € sur 20,00 € (marge 1,00 €) ; une ligne pèse ensuite 1,00 € de moins.
      "a decrease raising no line applies, even beyond the tolerance after an accepted increase",
      decide(
        2300,
        2200,
        [
          [1000, 1300, 1300],
          [1000, 900, 1000],
        ],
        S20
      ),
      { decision: "APPLY", reason: "DECREASE", cumulatedIncreaseCents: 200 },
    ],
    [
      "a decrease raising no line applies on an order without tolerance nor estimates",
      decide(1000, 900, [[null, 900, 1000]], null),
      { decision: "APPLY", reason: "DECREASE", toleranceCents: 0, cumulatedIncreaseCents: null },
    ],
    [
      "a new unit price raising a line is asked, though the total goes down",
      decide(
        2500,
        2400,
        [
          [2000, 1500, 2000],
          [500, 900, 500],
        ],
        S25,
        "PRICE"
      ),
      { decision: "ASK", reason: "NOT_WEIGHING", cumulatedIncreaseCents: -100 },
    ],
    [
      "an order without tolerance: zeroed and inflated is asked",
      decide(
        2500,
        600,
        [
          [2000, 0, 2000],
          [500, 600, 500],
        ],
        null
      ),
      { decision: "ASK", reason: "NO_TOLERANCE", toleranceCents: 0, cumulatedIncreaseCents: 100 },
    ],
  ])("%s", (_label, decision, expected) => {
    expect(decision).toMatchObject(expected);
  });
});

describe("estimatedTotalOf", () => {
  it.each<[Array<number | null>, number, number | null]>([
    [[1000, 724], 100, 1624], // 17,24 € moins 1,00 € de remise
    [[300], 500, 0], // la remise ne dépasse jamais les lignes
    [[], 0, 0],
    [[1000, null], 0, null], // une ligne sans estimation : pas de total estimé
  ])("%o minus a discount of %i -> %s", (estimates, discount, expected) => {
    expect(estimatedTotalOf(estimates, discount)).toBe(expected);
  });

  it("refuses amounts that are not whole, non-negative cents", () => {
    expect(() => estimatedTotalOf([10.5], 0)).toThrow(RangeError);
    expect(() => estimatedTotalOf([1000], -1)).toThrow(RangeError);
  });
});
