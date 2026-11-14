// @vitest-environment node
//
// The order line: what the cart sends, what the order stores, what screens show.
// Until this module existed the cart sent kilograms AND grams, and the server
// multiplied by both: 500 g was billed at a quarter of the per-kg price, 2 kg at
// four times. These tables lock the one formula everybody now calls.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  MAX_LINE_QUANTITY,
  MAX_PORTION_GRAMS,
  assertCents,
  checkLineQuantity,
  describeStoredLine,
  isWeighedUnit,
  lineQuantityFromStored,
  lineTotalCents,
  lineUnits,
  portionPriceCents,
  storedLineUnits,
  toStoredQuantity,
  type LineQuantity,
  type LineQuantityIssue,
  type SaleUnit,
  type StoredLine,
} from "@/lib/pricing/line";

describe("isWeighedUnit", () => {
  it.each<[SaleUnit, boolean]>([
    ["KG", true],
    ["TRANCHE", true],
    ["PIECE", false],
    ["BARQUETTE", false],
  ])("%s => %s", (unit, expected) => {
    expect(isWeighedUnit(unit)).toBe(expected);
  });
});

describe("bounds", () => {
  it("should cap a line at 99 portions or units of at most 50 kg each", () => {
    expect(MAX_LINE_QUANTITY).toBe(99);
    expect(MAX_PORTION_GRAMS).toBe(50_000);
  });
});

describe("assertCents", () => {
  it.each([0, 1, 1911, 2_147_483_647])("should accept %d", (value) => {
    expect(() => assertCents("amount", value)).not.toThrow();
  });

  it.each([-1, 0.5, 19.11, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "should throw RangeError on %d",
    (value) => {
      expect(() => assertCents("amount", value)).toThrow(RangeError);
    }
  );
});

describe("portionPriceCents", () => {
  // [price per kg, grams, expected] — floor((price * grams + 500) / 1000), half-up.
  it.each([
    [1911, 500, 956], // 955,5 rounds up
    [1911, 250, 478], // 477,75
    [1911, 2000, 3822],
    [1911, 1000, 1911],
    [1999, 333, 666], // 665,667
    [1327, 500, 664], // 663,5 rounds up
    [1204, 250, 301],
    [1765, 300, 530], // 529,5 rounds up
    [1, 500, 1], // 0,5 rounds up
    [3, 500, 2], // 1,5 rounds up
    [5, 500, 3], // 2,5 rounds up (banker's rounding would give 2)
    [499, 1, 0], // 0,499 rounds down
    [500, 1, 1], // 0,5 rounds up
    [0, 500, 0],
    [1911, 0, 0],
    [2_147_483_647, 50_000, 107_374_182_350],
  ])("%d cents/kg x %d g => %d cents", (pricePerKgCents, grams, expected) => {
    expect(portionPriceCents(pricePerKgCents, grams)).toBe(expected);
  });

  it.each([
    [-1, 500],
    [19.11, 500],
    [Number.NaN, 500],
    [1911, -1],
    [1911, 250.5],
    [1911, Number.NaN],
    [1911, Number.POSITIVE_INFINITY],
  ])("should throw RangeError on (%d, %d)", (pricePerKgCents, grams) => {
    expect(() => portionPriceCents(pricePerKgCents, grams)).toThrow(RangeError);
  });
});

describe("lineTotalCents", () => {
  it.each<[string, LineQuantity, number, number]>([
    ["500 g at 19,11 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 500 }, 1911, 956],
    ["250 g at 19,11 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 250 }, 1911, 478],
    ["2 kg at 19,11 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 2000 }, 1911, 3822],
    ["2 x 500 g at 19,11 EUR/kg", { unit: "KG", quantity: 2, weightGrams: 500 }, 1911, 1912],
    ["3 x 333 g at 19,99 EUR/kg", { unit: "KG", quantity: 3, weightGrams: 333 }, 1999, 1998],
    ["500 g at 13,27 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 500 }, 1327, 664],
    ["500 g at 12,04 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 500 }, 1204, 602],
    ["250 g at 12,04 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 250 }, 1204, 301],
    ["2 kg at 12,04 EUR/kg", { unit: "KG", quantity: 1, weightGrams: 2000 }, 1204, 2408],
    [
      "2 x 150 g of slices at 24,90 EUR/kg",
      { unit: "TRANCHE", quantity: 2, weightGrams: 150 },
      2490,
      748,
    ],
    ["3 pieces at 5,74 EUR", { unit: "PIECE", quantity: 3 }, 574, 1722],
    [
      "3 pieces, weight explicitly null",
      { unit: "PIECE", quantity: 3, weightGrams: null },
      574,
      1722,
    ],
    ["2 trays at 8,50 EUR", { unit: "BARQUETTE", quantity: 2 }, 850, 1700],
    [
      "99 x 50 kg, the largest line",
      { unit: "KG", quantity: 99, weightGrams: 50_000 },
      1911,
      9_459_450,
    ],
    ["a free product", { unit: "PIECE", quantity: 4 }, 0, 0],
  ])("%s", (_label, line, unitPriceCents, expected) => {
    expect(lineTotalCents(line, unitPriceCents)).toBe(expected);
  });

  it("should charge N identical portions exactly N times the displayed portion price", () => {
    for (const pricePerKgCents of [1, 999, 1204, 1327, 1911, 1999, 2237]) {
      for (const weightGrams of [1, 50, 125, 250, 333, 500, 750, 1250, 5000]) {
        const portion = portionPriceCents(pricePerKgCents, weightGrams);
        for (let quantity = 1; quantity <= MAX_LINE_QUANTITY; quantity += 1) {
          expect(lineTotalCents({ unit: "KG", quantity, weightGrams }, pricePerKgCents)).toBe(
            quantity * portion
          );
        }
      }
    }
  });

  it.each([-1, 19.11, Number.NaN])(
    "should throw RangeError on a unit price of %d",
    (unitPriceCents) => {
      expect(() => lineTotalCents({ unit: "PIECE", quantity: 1 }, unitPriceCents)).toThrow(
        RangeError
      );
      expect(() =>
        lineTotalCents({ unit: "KG", quantity: 1, weightGrams: 500 }, unitPriceCents)
      ).toThrow(RangeError);
    }
  );
});

describe("checkLineQuantity", () => {
  it.each<[string, LineQuantity]>([
    ["one portion of 500 g", { unit: "KG", quantity: 1, weightGrams: 500 }],
    ["one portion of 1 g", { unit: "KG", quantity: 1, weightGrams: 1 }],
    ["99 portions of 50 kg", { unit: "KG", quantity: 99, weightGrams: 50_000 }],
    ["two portions of slices", { unit: "TRANCHE", quantity: 2, weightGrams: 150 }],
    ["three pieces", { unit: "PIECE", quantity: 3 }],
    ["three pieces, weight null", { unit: "PIECE", quantity: 3, weightGrams: null }],
    ["one tray, weight undefined", { unit: "BARQUETTE", quantity: 1, weightGrams: undefined }],
    ["99 trays", { unit: "BARQUETTE", quantity: 99 }],
  ])("should accept %s", (_label, line) => {
    expect(checkLineQuantity(line)).toBeNull();
  });

  const refused: Array<[string, LineQuantity, LineQuantityIssue]> = [
    ["half a piece", { unit: "PIECE", quantity: 0.5 }, "QUANTITY_INVALID"],
    ["zero pieces", { unit: "PIECE", quantity: 0 }, "QUANTITY_INVALID"],
    ["100 pieces", { unit: "PIECE", quantity: 100 }, "QUANTITY_INVALID"],
    ["a negative count", { unit: "BARQUETTE", quantity: -1 }, "QUANTITY_INVALID"],
    ["a NaN count", { unit: "PIECE", quantity: Number.NaN }, "QUANTITY_INVALID"],
    [
      "an infinite count",
      { unit: "PIECE", quantity: Number.POSITIVE_INFINITY },
      "QUANTITY_INVALID",
    ],
    [
      "kilograms sent as the quantity (the old cart)",
      { unit: "KG", quantity: 0.5, weightGrams: 500 },
      "QUANTITY_INVALID",
    ],
    ["100 portions", { unit: "KG", quantity: 100, weightGrams: 500 }, "QUANTITY_INVALID"],
    ["a KG line without weight", { unit: "KG", quantity: 1 }, "WEIGHT_REQUIRED"],
    [
      "a KG line with a null weight",
      { unit: "KG", quantity: 1, weightGrams: null },
      "WEIGHT_REQUIRED",
    ],
    ["a TRANCHE line without weight", { unit: "TRANCHE", quantity: 2 }, "WEIGHT_REQUIRED"],
    [
      "a PIECE line with a weight",
      { unit: "PIECE", quantity: 1, weightGrams: 500 },
      "WEIGHT_FORBIDDEN",
    ],
    [
      "a BARQUETTE line with a weight of 0",
      { unit: "BARQUETTE", quantity: 1, weightGrams: 0 },
      "WEIGHT_FORBIDDEN",
    ],
    ["a weight of 0", { unit: "KG", quantity: 1, weightGrams: 0 }, "WEIGHT_INVALID"],
    ["a weight of 50 001 g", { unit: "KG", quantity: 1, weightGrams: 50_001 }, "WEIGHT_INVALID"],
    ["a negative weight", { unit: "KG", quantity: 1, weightGrams: -100 }, "WEIGHT_INVALID"],
    ["a fractional weight", { unit: "TRANCHE", quantity: 1, weightGrams: 250.5 }, "WEIGHT_INVALID"],
    ["a NaN weight", { unit: "KG", quantity: 1, weightGrams: Number.NaN }, "WEIGHT_INVALID"],
  ];

  it.each(refused)("should refuse %s", (_label, line, issue) => {
    expect(checkLineQuantity(line)).toBe(issue);
  });

  it.each(refused)("lineTotalCents should throw RangeError on %s", (_label, line) => {
    expect(() => lineTotalCents(line, 1911)).toThrow(RangeError);
  });

  it.each(refused)(
    "lineUnits and toStoredQuantity should throw RangeError on %s",
    (_label, line) => {
      expect(() => lineUnits(line)).toThrow(RangeError);
      expect(() => toStoredQuantity(line)).toThrow(RangeError);
    }
  );
});

describe("lineUnits", () => {
  it.each<[string, LineQuantity, number]>([
    [
      "3 portions of 500 g hold 3 units, never 1,5 kg",
      { unit: "KG", quantity: 3, weightGrams: 500 },
      3,
    ],
    ["1 portion of 2 kg holds 1 unit", { unit: "KG", quantity: 1, weightGrams: 2000 }, 1],
    ["2 portions of slices", { unit: "TRANCHE", quantity: 2, weightGrams: 150 }, 2],
    ["4 pieces", { unit: "PIECE", quantity: 4 }, 4],
    ["1 tray", { unit: "BARQUETTE", quantity: 1 }, 1],
  ])("%s", (_label, line, expected) => {
    expect(lineUnits(line)).toBe(expected);
  });
});

describe("toStoredQuantity", () => {
  it.each<[string, LineQuantity, number]>([
    ["1 x 500 g is stored as 0,5 kg", { unit: "KG", quantity: 1, weightGrams: 500 }, 0.5],
    ["2 x 500 g is stored as 1 kg", { unit: "KG", quantity: 2, weightGrams: 500 }, 1],
    ["3 x 333 g is stored as 0,999 kg", { unit: "KG", quantity: 3, weightGrams: 333 }, 0.999],
    ["1 x 2 kg is stored as 2 kg", { unit: "KG", quantity: 1, weightGrams: 2000 }, 2],
    [
      "2 x 150 g of slices is stored as 0,3 kg",
      { unit: "TRANCHE", quantity: 2, weightGrams: 150 },
      0.3,
    ],
    ["3 pieces are stored as 3", { unit: "PIECE", quantity: 3 }, 3],
    ["1 tray is stored as 1", { unit: "BARQUETTE", quantity: 1 }, 1],
  ])("%s", (_label, line, expected) => {
    expect(toStoredQuantity(line)).toBe(expected);
  });
});

describe("request line -> stored row -> request line", () => {
  it("should give back the same portions for 1..20 portions of 50..5000 g by steps of 50", () => {
    for (const unit of ["KG", "TRANCHE"] as const) {
      for (let quantity = 1; quantity <= 20; quantity += 1) {
        for (let weightGrams = 50; weightGrams <= 5000; weightGrams += 50) {
          const line: LineQuantity = { unit, quantity, weightGrams };
          const stored: StoredLine = { unit, quantity: toStoredQuantity(line), weightGrams };
          const view = describeStoredLine(stored);
          const label = `${quantity} x ${weightGrams} g (${unit})`;

          expect(view.portions, label).toEqual({ count: quantity, gramsEach: weightGrams });
          expect(view.totalGrams, label).toBe(quantity * weightGrams);
          expect(lineQuantityFromStored(stored), label).toStrictEqual(line);
          expect(storedLineUnits(stored), label).toBe(lineUnits(line));
        }
      }
    }
  });

  it("should survive binary floats for every portion count and awkward weights", () => {
    for (const weightGrams of [1, 3, 7, 33, 111, 333, 999, 1001, 4999, 12_345, 49_999, 50_000]) {
      for (let quantity = 1; quantity <= MAX_LINE_QUANTITY; quantity += 1) {
        const line: LineQuantity = { unit: "KG", quantity, weightGrams };
        const stored: StoredLine = { unit: "KG", quantity: toStoredQuantity(line), weightGrams };

        expect(describeStoredLine(stored).portions, `${quantity} x ${weightGrams} g`).toEqual({
          count: quantity,
          gramsEach: weightGrams,
        });
      }
    }
  });

  it("should read every row the previous cart wrote as (grams / 1000) x portions", () => {
    for (const weightGrams of [1, 7, 50, 111, 250, 333, 350, 999, 1250, 4999, 5000]) {
      for (let quantity = 1; quantity <= MAX_LINE_QUANTITY; quantity += 1) {
        const stored: StoredLine = {
          unit: "KG",
          quantity: (weightGrams / 1000) * quantity,
          weightGrams,
        };

        expect(describeStoredLine(stored).portions, `${quantity} x ${weightGrams} g`).toEqual({
          count: quantity,
          gramsEach: weightGrams,
        });
      }
    }
  });

  it("should keep counted lines unchanged", () => {
    for (const unit of ["PIECE", "BARQUETTE"] as const) {
      for (let quantity = 1; quantity <= MAX_LINE_QUANTITY; quantity += 1) {
        const line: LineQuantity = { unit, quantity };
        const stored: StoredLine = { unit, quantity: toStoredQuantity(line), weightGrams: null };

        expect(describeStoredLine(stored).count).toBe(quantity);
        expect(lineQuantityFromStored(stored)).toStrictEqual(line);
        expect(storedLineUnits(stored)).toBe(quantity);
      }
    }
  });
});

describe("describeStoredLine", () => {
  it.each<[string, StoredLine, ReturnType<typeof describeStoredLine>]>([
    [
      "0,5 kg in portions of 500 g is 1 x 500 g",
      { unit: "KG", quantity: 0.5, weightGrams: 500 },
      {
        unit: "KG",
        weighed: true,
        totalGrams: 500,
        portions: { count: 1, gramsEach: 500 },
        count: null,
      },
    ],
    [
      "1 kg in portions of 500 g is 2 x 500 g",
      { unit: "KG", quantity: 1, weightGrams: 500 },
      {
        unit: "KG",
        weighed: true,
        totalGrams: 1000,
        portions: { count: 2, gramsEach: 500 },
        count: null,
      },
    ],
    [
      "a butcher weight adjustment to 0,47 kg leaves no portions",
      { unit: "KG", quantity: 0.47, weightGrams: 500 },
      { unit: "KG", weighed: true, totalGrams: 470, portions: null, count: null },
    ],
    [
      "an adjustment above the request (1,2 kg for 2 x 500 g) leaves no portions",
      { unit: "KG", quantity: 1.2, weightGrams: 500 },
      { unit: "KG", weighed: true, totalGrams: 1200, portions: null, count: null },
    ],
    [
      "a legacy row without weight (1 kg) is 1 x 1000 g",
      { unit: "KG", quantity: 1, weightGrams: null },
      {
        unit: "KG",
        weighed: true,
        totalGrams: 1000,
        portions: { count: 1, gramsEach: 1000 },
        count: null,
      },
    ],
    [
      "the old cart's 3 x 333 g, stored with float noise",
      { unit: "KG", quantity: (333 / 1000) * 3, weightGrams: 333 },
      {
        unit: "KG",
        weighed: true,
        totalGrams: 999,
        portions: { count: 3, gramsEach: 333 },
        count: null,
      },
    ],
    [
      "0,3 kg of slices in portions of 150 g is 2 x 150 g",
      { unit: "TRANCHE", quantity: 0.3, weightGrams: 150 },
      {
        unit: "TRANCHE",
        weighed: true,
        totalGrams: 300,
        portions: { count: 2, gramsEach: 150 },
        count: null,
      },
    ],
    [
      "a line the butcher weighed at 0 kg",
      { unit: "KG", quantity: 0, weightGrams: 500 },
      { unit: "KG", weighed: true, totalGrams: 0, portions: null, count: null },
    ],
    [
      "a legacy row at 0 kg without weight",
      { unit: "KG", quantity: 0, weightGrams: null },
      { unit: "KG", weighed: true, totalGrams: 0, portions: null, count: null },
    ],
    [
      "a stored weight of 0 is not a usable split",
      { unit: "KG", quantity: 0.5, weightGrams: 0 },
      { unit: "KG", weighed: true, totalGrams: 500, portions: null, count: null },
    ],
    [
      "3 pieces",
      { unit: "PIECE", quantity: 3, weightGrams: null },
      { unit: "PIECE", weighed: false, totalGrams: null, portions: null, count: 3 },
    ],
    [
      "2 trays",
      { unit: "BARQUETTE", quantity: 2, weightGrams: null },
      { unit: "BARQUETTE", weighed: false, totalGrams: null, portions: null, count: 2 },
    ],
    [
      "a legacy fractional count is reported as stored",
      { unit: "PIECE", quantity: 1.5, weightGrams: null },
      { unit: "PIECE", weighed: false, totalGrams: null, portions: null, count: 1.5 },
    ],
  ])("%s", (_label, item, expected) => {
    expect(describeStoredLine(item)).toStrictEqual(expected);
  });

  it.each([-1, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should throw RangeError on a stored quantity of %d",
    (quantity) => {
      expect(() => describeStoredLine({ unit: "KG", quantity, weightGrams: 500 })).toThrow(
        RangeError
      );
      expect(() => describeStoredLine({ unit: "PIECE", quantity, weightGrams: null })).toThrow(
        RangeError
      );
    }
  );
});

describe("storedLineUnits", () => {
  it.each<[string, StoredLine, number]>([
    ["(KG, 0.5, 500) holds 1 unit", { unit: "KG", quantity: 0.5, weightGrams: 500 }, 1],
    ["(KG, 1, 500) holds 2 units", { unit: "KG", quantity: 1, weightGrams: 500 }, 2],
    [
      "(KG, 0.47, 500), adjusted, holds 1 unit",
      { unit: "KG", quantity: 0.47, weightGrams: 500 },
      1,
    ],
    ["(KG, 1, null), legacy, holds 1 unit", { unit: "KG", quantity: 1, weightGrams: null }, 1],
    ["(PIECE, 3, null) holds 3 units", { unit: "PIECE", quantity: 3, weightGrams: null }, 3],
    ["(TRANCHE, 0.3, 150) holds 2 units", { unit: "TRANCHE", quantity: 0.3, weightGrams: 150 }, 2],
    ["(KG, 0, 500) holds 1 unit", { unit: "KG", quantity: 0, weightGrams: 500 }, 1],
    [
      "(BARQUETTE, 2, null) holds 2 units",
      { unit: "BARQUETTE", quantity: 2, weightGrams: null },
      2,
    ],
    [
      "a legacy 1,5 piece occupies 2 whole units",
      { unit: "PIECE", quantity: 1.5, weightGrams: null },
      2,
    ],
    [
      "a legacy 0,25 piece occupies 1 whole unit",
      { unit: "PIECE", quantity: 0.25, weightGrams: null },
      1,
    ],
    [
      "a counted row adjusted to 0 holds nothing",
      { unit: "PIECE", quantity: 0, weightGrams: null },
      0,
    ],
  ])("%s", (_label, item, expected) => {
    expect(storedLineUnits(item)).toBe(expected);
  });
});

describe("lineQuantityFromStored", () => {
  it.each<[string, StoredLine, LineQuantity]>([
    [
      "2 x 500 g",
      { unit: "KG", quantity: 1, weightGrams: 500 },
      { unit: "KG", quantity: 2, weightGrams: 500 },
    ],
    [
      "1 x 500 g",
      { unit: "KG", quantity: 0.5, weightGrams: 500 },
      { unit: "KG", quantity: 1, weightGrams: 500 },
    ],
    [
      "an adjusted row becomes one portion of the weighed total",
      { unit: "KG", quantity: 0.47, weightGrams: 500 },
      { unit: "KG", quantity: 1, weightGrams: 470 },
    ],
    [
      "a legacy row without weight becomes one portion of the total",
      { unit: "KG", quantity: 1, weightGrams: null },
      { unit: "KG", quantity: 1, weightGrams: 1000 },
    ],
    [
      "slices",
      { unit: "TRANCHE", quantity: 0.3, weightGrams: 150 },
      { unit: "TRANCHE", quantity: 2, weightGrams: 150 },
    ],
    [
      "pieces carry no weight key",
      { unit: "PIECE", quantity: 3, weightGrams: null },
      { unit: "PIECE", quantity: 3 },
    ],
    [
      "trays carry no weight key",
      { unit: "BARQUETTE", quantity: 1, weightGrams: null },
      { unit: "BARQUETTE", quantity: 1 },
    ],
  ])("%s", (_label, item, expected) => {
    const line = lineQuantityFromStored(item);
    expect(line).toStrictEqual(expected);
    expect(checkLineQuantity(line)).toBeNull();
  });

  it.each<[string, StoredLine, LineQuantityIssue]>([
    [
      "a legacy 60 kg row exceeds the portion bound",
      { unit: "KG", quantity: 60, weightGrams: null },
      "WEIGHT_INVALID",
    ],
    [
      "a row weighed at 0 kg has no weight to order",
      { unit: "KG", quantity: 0, weightGrams: 500 },
      "WEIGHT_INVALID",
    ],
    [
      "a legacy fractional count",
      { unit: "PIECE", quantity: 1.5, weightGrams: null },
      "QUANTITY_INVALID",
    ],
    [
      "a legacy count of 100",
      { unit: "PIECE", quantity: 100, weightGrams: null },
      "QUANTITY_INVALID",
    ],
  ])("should hand over a line that checkLineQuantity refuses: %s", (_label, item, issue) => {
    expect(checkLineQuantity(lineQuantityFromStored(item))).toBe(issue);
  });
});

describe("src/lib/pricing stays pure and client-safe", () => {
  // The cart and the product sheets import these modules in the browser, and the server prices
  // orders with them: a database client, a clock or any I/O here would break one of the two.
  const directory = path.join(process.cwd(), "src", "lib", "pricing");
  const modules = fs.readdirSync(directory).filter((name) => name.endsWith(".ts"));
  const IMPORT = /\b(?:import|export)\s+(type\s+)?[^;"']*?\bfrom\s+["']([^"']+)["']/g;

  it("should find the pricing modules", () => {
    expect(modules).toEqual(
      expect.arrayContaining(["discount.ts", "format.ts", "line.ts", "totals.ts", "unit-price.ts"])
    );
  });

  it.each(modules)("%s imports only its siblings, the fee constant, or Prisma types", (name) => {
    const source = fs.readFileSync(path.join(directory, name), "utf8");
    const refused = [...source.matchAll(IMPORT)]
      .map((match) => ({ typeOnly: match[1] !== undefined, specifier: match[2] }))
      .filter(
        ({ typeOnly, specifier }) =>
          !specifier.startsWith("./") &&
          specifier !== "@/lib/services/stripe/commission" &&
          !(typeOnly && specifier === "@prisma/client")
      );

    expect(refused).toEqual([]);
    expect(source).not.toMatch(/\brequire\(|\bimport\(|^import\s+["']/m);
  });

  it.each(modules)("%s never reads the clock: time is a parameter", (name) => {
    const source = fs.readFileSync(path.join(directory, name), "utf8");
    expect(source).not.toMatch(/Date\.now\(|new Date\(\s*\)|performance\.now\(/);
  });
});
