// @vitest-environment node
//
// A line weighed or priced again by the butcher, the lines the weighing tolerance measures after
// the change, and the statuses that set the order's total. The total of a line comes from line.ts
// like at checkout: priced round(priceCents x kg), weighing the same 2,331 kg again moved the line
// from 16,02 € to 16,01 €. The planner is covered by pricing-adjustment-plan.test.ts.
import type { AdjustmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  availableLinesAfter,
  isAdjustmentApplied,
  repriceLine,
  reweighLine,
  type AdjustableLine,
  type MeasuredLine,
} from "@/lib/pricing/adjustment";
import { lineTotalCents } from "@/lib/pricing/line";

const THREE_777G: AdjustableLine = {
  unit: "KG",
  quantity: 2.331,
  weightGrams: 777,
  priceCents: 687,
};

describe("reweighLine", () => {
  it("keeps the checkout total when the same weight is weighed again", () => {
    const checkout = lineTotalCents({ unit: "KG", quantity: 3, weightGrams: 777 }, 687);
    expect(checkout).toBe(1602); // 3 x floor((687 x 777 + 500) / 1000) = 3 x 534
    expect(reweighLine(THREE_777G, 2.331)).toEqual({
      ok: true,
      quantity: 2.331,
      priceCents: 687,
      totalCents: 1602,
    });
  });

  it("prices a weight that no longer splits into the portions as one portion of the weighed grams", () => {
    // floor((687 x 2500 + 500) / 1000) = floor(1718000 / 1000)
    expect(reweighLine(THREE_777G, 2.5)).toEqual({
      ok: true,
      quantity: 2.5,
      priceCents: 687,
      totalCents: 1718,
    });
  });

  it("accepts 0: nothing delivered", () => {
    expect(reweighLine(THREE_777G, 0)).toEqual({
      ok: true,
      quantity: 0,
      priceCents: 687,
      totalCents: 0,
    });
  });

  it.each([
    ["a fraction of a gram", 1.2345],
    ["a negative weight", -1],
    ["a single portion over 50 kg", 60],
    ["a weight that is not a number", Number.NaN],
  ])("refuses %s", (_label, kg) => {
    expect(reweighLine(THREE_777G, kg)).toEqual({ ok: false, reason: "QUANTITY_INVALID" });
  });

  it("counts counted units in whole numbers", () => {
    const trays: AdjustableLine = {
      unit: "BARQUETTE",
      quantity: 2,
      weightGrams: null,
      priceCents: 1576,
    };
    expect(reweighLine(trays, 3)).toEqual({
      ok: true,
      quantity: 3,
      priceCents: 1576,
      totalCents: 4728,
    });
    expect(reweighLine(trays, 1.5)).toEqual({ ok: false, reason: "QUANTITY_INVALID" });
  });
});

describe("repriceLine", () => {
  it("prices the same portions at the new per-kg price", () => {
    // 3 x floor((700 x 777 + 500) / 1000) = 3 x 544
    expect(repriceLine(THREE_777G, 700)).toEqual({
      ok: true,
      quantity: 2.331,
      priceCents: 700,
      totalCents: 1632,
    });
  });

  it("refuses a price that is not whole cents and a line that cannot be priced", () => {
    expect(repriceLine(THREE_777G, 12.5)).toEqual({ ok: false, reason: "PRICE_INVALID" });
    const legacyFraction: AdjustableLine = {
      unit: "PIECE",
      quantity: 1.5,
      weightGrams: null,
      priceCents: 300,
    };
    expect(repriceLine(legacyFraction, 400)).toEqual({ ok: false, reason: "LINE_NOT_ADJUSTABLE" });
  });
});

describe("availableLinesAfter", () => {
  const LINES: MeasuredLine[] = [
    { id: "a", available: true, unit: "TRANCHE", totalCents: 2000, estimatedPriceCents: 2000 },
    { id: "b", available: false, unit: "KG", totalCents: 2000, estimatedPriceCents: 2000 },
    { id: "c", available: true, unit: "BARQUETTE", totalCents: 1000, estimatedPriceCents: null },
  ];

  it("keeps the available lines, a changed one at its new total, its total before and its unit", () => {
    expect(availableLinesAfter(LINES, [{ orderItemId: "a", newTotalCents: 2150 }])).toEqual([
      { estimatedPriceCents: 2000, totalCents: 2150, previousTotalCents: 2000, weighed: true },
      { estimatedPriceCents: null, totalCents: 1000, previousTotalCents: 1000, weighed: false },
    ]);
  });

  it("keeps a line counted at 0, at total 0", () => {
    expect(availableLinesAfter(LINES, [{ orderItemId: "c", newTotalCents: 0 }])).toEqual([
      { estimatedPriceCents: 2000, totalCents: 2000, previousTotalCents: 2000, weighed: true },
      { estimatedPriceCents: null, totalCents: 0, previousTotalCents: 1000, weighed: false },
    ]);
  });
});

describe("isAdjustmentApplied", () => {
  it.each<[AdjustmentStatus, boolean]>([
    ["PENDING", false],
    ["AUTO_APPROVED", true],
    ["APPROVED", true],
    ["REJECTED", false],
    ["AUTO_VALIDATED", true],
    ["ESCALATED", false],
  ])("%s sets the order's total: %s", (status, applied) => {
    expect(isAdjustmentApplied(status)).toBe(applied);
  });
});
