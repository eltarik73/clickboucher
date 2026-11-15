// @vitest-environment node
// Lignes mesurées par la marge de pesée après un ajustement : une ligne changée prend son nouveau
// total, une ligne repesée à 0 reste une ligne, une ligne en rupture ou retirée ne compte plus (elle
// ne donne aucune marge aux autres).
import { describe, expect, it } from "vitest";
import { availableLinesAfter, type MeasuredLine } from "@/lib/pricing/adjustment";
import { decideAdjustment, WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";

const LINES: MeasuredLine[] = [
  { id: "a", available: true, totalCents: 2000, estimatedPriceCents: 2000 },
  { id: "b", available: false, totalCents: 2000, estimatedPriceCents: 2000 },
  { id: "c", available: true, totalCents: 1000, estimatedPriceCents: null },
];

describe("availableLinesAfter", () => {
  it("keeps the available lines, a changed one at its new total, a line weighed at 0 included", () => {
    expect(availableLinesAfter(LINES, [{ orderItemId: "a", newTotalCents: 2150 }])).toEqual([
      { estimatedCents: 2000, totalCents: 2150 },
      { estimatedCents: null, totalCents: 1000 },
    ]);
    expect(availableLinesAfter(LINES, [{ orderItemId: "c", newTotalCents: 0 }])).toEqual([
      { estimatedCents: 2000, totalCents: 2000 },
      { estimatedCents: null, totalCents: 0 },
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
