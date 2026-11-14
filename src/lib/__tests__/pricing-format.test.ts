// @vitest-environment node
//
// French text of a weight and of a stored order line, for tickets, the kitchen
// card, e-mails and the tracking page. Screens used to print the stored
// quantity as it was (« 0.5 kg … 500g », « 0.47 pc »): this module is the one
// place that turns a stored row into words.
//
// Every space inside a quantity is a no-break space (U+00A0), so a quantity
// never wraps in the middle on an 80 mm ticket.

import { describe, it, expect } from "vitest";
import { formatGrams, formatStoredLineQuantity } from "@/lib/pricing/format";
import type { StoredLine } from "@/lib/pricing/line";

const NBSP = " ";
/** Writes the expected strings with ordinary spaces; each one is a no-break space in the output. */
const fr = (text: string): string => text.replace(/ /g, NBSP);

describe("formatGrams", () => {
  it.each<[number, string]>([
    [500, "500 g"],
    [50, "50 g"],
    [1, "1 g"],
    [0, "0 g"],
    [999, "999 g"],
    [1000, "1 kg"],
    [1200, "1,2 kg"],
    [1500, "1,5 kg"],
    [2000, "2 kg"],
    [1250, "1,25 kg"],
    [1234, "1,234 kg"],
    [1005, "1,005 kg"],
    [12_050, "12,05 kg"],
    [50_000, "50 kg"],
  ])("%d g => %s", (grams, expected) => {
    expect(formatGrams(grams)).toBe(fr(expected));
  });

  it("should put a no-break space, not a plain space, before the unit", () => {
    expect(formatGrams(500)).toBe("500 g");
    expect(formatGrams(1200)).toBe("1,2 kg");
    expect(formatGrams(500)).not.toContain(" ");
  });

  it.each([-1, 250.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should throw RangeError on %d",
    (grams) => {
      expect(() => formatGrams(grams)).toThrow(RangeError);
    }
  );
});

describe("formatStoredLineQuantity", () => {
  it.each<[string, StoredLine, string]>([
    ["two portions of 500 g", { unit: "KG", quantity: 1, weightGrams: 500 }, "2 × 500 g"],
    ["one portion of 500 g", { unit: "KG", quantity: 0.5, weightGrams: 500 }, "500 g"],
    [
      "a line the butcher weighed at 470 g",
      { unit: "KG", quantity: 0.47, weightGrams: 500 },
      "470 g",
    ],
    [
      "a legacy row of 1,5 kg without portion weight",
      { unit: "KG", quantity: 1.5, weightGrams: null },
      "1,5 kg",
    ],
    ["one portion of 1,2 kg", { unit: "KG", quantity: 1.2, weightGrams: 1200 }, "1,2 kg"],
    ["one portion of 2 kg", { unit: "KG", quantity: 2, weightGrams: 2000 }, "2 kg"],
    ["two portions of 1,5 kg", { unit: "KG", quantity: 3, weightGrams: 1500 }, "2 × 1,5 kg"],
    ["three portions of 333 g", { unit: "KG", quantity: 0.999, weightGrams: 333 }, "3 × 333 g"],
    ["two portions of slices", { unit: "TRANCHE", quantity: 0.3, weightGrams: 150 }, "2 × 150 g"],
    ["one portion of slices", { unit: "TRANCHE", quantity: 0.15, weightGrams: 150 }, "150 g"],
    ["a line weighed at nothing", { unit: "KG", quantity: 0, weightGrams: 500 }, "0 g"],
    ["three pieces", { unit: "PIECE", quantity: 3, weightGrams: null }, "3 pièces"],
    ["one piece", { unit: "PIECE", quantity: 1, weightGrams: null }, "1 pièce"],
    ["two pieces", { unit: "PIECE", quantity: 2, weightGrams: null }, "2 pièces"],
    ["one tray", { unit: "BARQUETTE", quantity: 1, weightGrams: null }, "1 barquette"],
    ["two trays", { unit: "BARQUETTE", quantity: 2, weightGrams: null }, "2 barquettes"],
    [
      "a legacy fractional count stays singular below 2",
      { unit: "PIECE", quantity: 1.5, weightGrams: null },
      "1,5 pièce",
    ],
    [
      "a legacy fractional count above 2",
      { unit: "BARQUETTE", quantity: 2.5, weightGrams: null },
      "2,5 barquettes",
    ],
    ["a count adjusted to nothing", { unit: "PIECE", quantity: 0, weightGrams: null }, "0 pièce"],
  ])("%s", (_label, item, expected) => {
    expect(formatStoredLineQuantity(item)).toBe(fr(expected));
  });

  it("should never contain a plain space", () => {
    expect(formatStoredLineQuantity({ unit: "KG", quantity: 1, weightGrams: 500 })).toBe(
      "2 × 500 g"
    );
    expect(formatStoredLineQuantity({ unit: "PIECE", quantity: 3, weightGrams: null })).toBe(
      "3 pièces"
    );
  });

  it("should throw RangeError on a negative stored quantity", () => {
    expect(() =>
      formatStoredLineQuantity({ unit: "KG", quantity: -0.5, weightGrams: 500 })
    ).toThrow(RangeError);
  });
});
