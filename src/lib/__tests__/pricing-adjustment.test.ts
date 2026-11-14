// @vitest-environment node
//
// A line weighed or priced again by the butcher. The total comes from line.ts like at checkout:
// before this module the adjustment priced round(priceCents x kg), so weighing the same 2,331 kg
// again moved the line from 16,02 EUR to 16,01 EUR.
import { describe, expect, it } from "vitest";
import { repriceLine, reweighLine, type AdjustableLine } from "@/lib/pricing/adjustment";
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
    expect(checkout).toBe(1602);
    expect(Math.round(687 * 2.331)).toBe(1601);
    expect(reweighLine(THREE_777G, 2.331)).toEqual({
      ok: true,
      quantity: 2.331,
      priceCents: 687,
      totalCents: 1602,
    });
  });

  it("prices a weight that no longer splits into the portions as one portion of the weighed grams", () => {
    expect(reweighLine(THREE_777G, 2.5)).toEqual({
      ok: true,
      quantity: 2.5,
      priceCents: 687,
      totalCents: Math.floor((687 * 2500 + 500) / 1000),
    });
  });

  it("accepts 0 (nothing delivered) and refuses fractions of a gram, negatives and heavy single portions", () => {
    expect(reweighLine(THREE_777G, 0)).toEqual({
      ok: true,
      quantity: 0,
      priceCents: 687,
      totalCents: 0,
    });
    expect(reweighLine(THREE_777G, 1.2345)).toEqual({ ok: false, reason: "QUANTITY_INVALID" });
    expect(reweighLine(THREE_777G, -1)).toEqual({ ok: false, reason: "QUANTITY_INVALID" });
    expect(reweighLine(THREE_777G, 60)).toEqual({ ok: false, reason: "QUANTITY_INVALID" });
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
    expect(repriceLine(THREE_777G, 700)).toEqual({
      ok: true,
      quantity: 2.331,
      priceCents: 700,
      totalCents: 3 * Math.floor((700 * 777 + 500) / 1000),
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
