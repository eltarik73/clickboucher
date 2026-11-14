// @vitest-environment node
//
// The unit price of a product for a customer, computed from database rows only.
// Before this module the card, the cart and the server followed three rules
// (a promotion without end date was shown but not applied) and the server took
// the cut price from the request: any product could be ordered at any price.

import { describe, it, expect } from "vitest";
import {
  CUT_OPTION_ISSUE_MESSAGES,
  activeProductPromo,
  parseCutOptions,
  pricedCutOptions,
  resolveUnitPrice,
  type ProductPricing,
  type ProductPromo,
} from "@/lib/pricing/unit-price";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const FUTURE = new Date("2026-11-14T10:00:00.000Z");
const PAST = new Date("2026-11-12T10:00:00.000Z");

const CUTS = [
  { name: "Haché", priceCents: 2100 },
  { name: "En cubes", priceCents: 1790 },
];

describe("parseCutOptions", () => {
  it.each([[null], [undefined]])("should return no option for %s", (raw) => {
    expect(parseCutOptions(raw)).toEqual([]);
  });

  it("should return the options of the JSON column, in order", () => {
    expect(parseCutOptions(CUTS)).toEqual(CUTS);
    expect(parseCutOptions([])).toEqual([]);
    expect(parseCutOptions([{ name: "Offert", priceCents: 0 }])).toEqual([
      { name: "Offert", priceCents: 0 },
    ]);
  });

  it("should keep only the name and the price of each entry", () => {
    expect(parseCutOptions([{ name: "Haché", priceCents: 2100, note: "x" }])).toStrictEqual([
      { name: "Haché", priceCents: 2100 },
    ]);
  });

  it.each<[string, unknown]>([
    ["a string", "Haché"],
    ["a number", 42],
    ["an object that is not an array", { name: "Haché", priceCents: 2100 }],
    ["a null entry", [null]],
    ["a string entry", ["Haché"]],
    ["an array entry", [["Haché", 2100]]],
    ["an entry without price", [{ name: "Haché" }]],
    ["an entry without name", [{ priceCents: 2100 }]],
    ["a numeric name", [{ name: 12, priceCents: 2100 }]],
    ["an empty name", [{ name: "", priceCents: 2100 }]],
    ["a price sent as text", [{ name: "Haché", priceCents: "2100" }]],
    ["a fractional price", [{ name: "Haché", priceCents: 21.5 }]],
    ["a negative price", [{ name: "Haché", priceCents: -1 }]],
    ["a NaN price", [{ name: "Haché", priceCents: Number.NaN }]],
    ["one malformed entry among valid ones", [...CUTS, { name: "Tranché" }]],
  ])("should throw TypeError on %s", (_label, raw) => {
    expect(() => parseCutOptions(raw)).toThrow(TypeError);
  });
});

describe("pricedCutOptions", () => {
  it("should offer only the options priced at least 1 cent, in order", () => {
    expect(
      pricedCutOptions([
        { name: "Offert", priceCents: 0 },
        ...CUTS,
        { name: "Tranché", priceCents: 1 },
      ])
    ).toEqual([...CUTS, { name: "Tranché", priceCents: 1 }]);
  });

  it.each([[null], [undefined], [[]], [[{ name: "Offert", priceCents: 0 }]]])(
    "should offer no option for %j",
    (raw) => {
      expect(pricedCutOptions(raw)).toEqual([]);
    }
  );

  it("should throw TypeError on malformed cut options, like parseCutOptions", () => {
    expect(() => pricedCutOptions([{ name: "Haché" }])).toThrow(TypeError);
  });
});

describe("activeProductPromo", () => {
  it.each<[string, Omit<ProductPricing, "priceCents">, ProductPromo | null]>([
    ["no promotion fields", {}, null],
    [
      "every promotion field null",
      { promoPct: null, promoType: null, promoEnd: null, promoFixedCents: null },
      null,
    ],
    [
      "a percentage without end date is active (the product form writes promoEnd null)",
      { promoPct: 20, promoType: "PERCENTAGE", promoEnd: null },
      { kind: "PERCENT", pct: 20 },
    ],
    [
      "a percentage ending in the future",
      { promoPct: 20, promoType: "PERCENTAGE", promoEnd: FUTURE },
      { kind: "PERCENT", pct: 20 },
    ],
    [
      "an end date given as an ISO string",
      { promoPct: 15, promoType: "FLASH", promoEnd: FUTURE.toISOString() },
      { kind: "PERCENT", pct: 15 },
    ],
    ["a percentage that ended", { promoPct: 20, promoType: "PERCENTAGE", promoEnd: PAST }, null],
    [
      "a flash sale that ended",
      { promoPct: 30, promoType: "FLASH", promoEnd: PAST.toISOString() },
      null,
    ],
    [
      "a promotion ending exactly now is over",
      { promoPct: 20, promoType: "PERCENTAGE", promoEnd: NOW },
      null,
    ],
    ["a percentage with no type", { promoPct: 10, promoType: null }, { kind: "PERCENT", pct: 10 }],
    [
      "a percentage of type BUY_X_GET_Y",
      { promoPct: 10, promoType: "BUY_X_GET_Y" },
      { kind: "PERCENT", pct: 10 },
    ],
    [
      "1 % is the smallest percentage",
      { promoPct: 1, promoType: "PERCENTAGE" },
      { kind: "PERCENT", pct: 1 },
    ],
    [
      "99 % is the largest percentage",
      { promoPct: 99, promoType: "PERCENTAGE" },
      { kind: "PERCENT", pct: 99 },
    ],
    ["0 % is no promotion", { promoPct: 0, promoType: "PERCENTAGE" }, null],
    ["100 % is no promotion", { promoPct: 100, promoType: "PERCENTAGE" }, null],
    ["150 % is no promotion", { promoPct: 150, promoType: "PERCENTAGE" }, null],
    ["a negative percentage is no promotion", { promoPct: -5, promoType: "PERCENTAGE" }, null],
    ["a fractional percentage is no promotion", { promoPct: 12.5, promoType: "PERCENTAGE" }, null],
    [
      "a fixed amount",
      { promoType: "FIXED_AMOUNT", promoFixedCents: 300, promoPct: null, promoEnd: null },
      { kind: "FIXED", cents: 300 },
    ],
    [
      "a fixed amount ending in the future",
      { promoType: "FIXED_AMOUNT", promoFixedCents: 300, promoEnd: FUTURE },
      { kind: "FIXED", cents: 300 },
    ],
    [
      "a fixed amount that ended",
      { promoType: "FIXED_AMOUNT", promoFixedCents: 300, promoEnd: PAST },
      null,
    ],
    ["a fixed amount of 0", { promoType: "FIXED_AMOUNT", promoFixedCents: 0 }, null],
    ["a fixed type without amount", { promoType: "FIXED_AMOUNT", promoFixedCents: null }, null],
    [
      "a fixed type without amount ignores a leftover percentage",
      { promoType: "FIXED_AMOUNT", promoFixedCents: null, promoPct: 20 },
      null,
    ],
    [
      "a percentage type ignores a leftover fixed amount",
      { promoType: "PERCENTAGE", promoPct: 20, promoFixedCents: 300 },
      { kind: "PERCENT", pct: 20 },
    ],
  ])("%s", (_label, promoFields, expected) => {
    expect(activeProductPromo({ priceCents: 2237, ...promoFields }, NOW)).toEqual(expected);
  });

  it("should throw TypeError on an end date that is not a date", () => {
    expect(() =>
      activeProductPromo({ priceCents: 2237, promoPct: 20, promoEnd: "demain" }, NOW)
    ).toThrow(TypeError);
  });

  it("should throw TypeError when the current time is not a date", () => {
    expect(() =>
      activeProductPromo({ priceCents: 2237, promoPct: 20, promoEnd: FUTURE }, new Date("x"))
    ).toThrow(TypeError);
  });
});

describe("resolveUnitPrice", () => {
  const product: ProductPricing = { priceCents: 2237, proPriceCents: 1500, cutOptions: CUTS };

  // [label, product, options, unit price, base, promo, cut option]
  it.each<
    [
      string,
      ProductPricing,
      { isPro: boolean; cutOption?: string | null },
      {
        unitPriceCents: number;
        baseCents: number;
        promo: ProductPromo | null;
        cutOption: string | null;
      },
    ]
  >([
    [
      "the public price",
      { priceCents: 2237 },
      { isPro: false },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "2237 with a 20 % promotion is 1790 (1789,6 rounds up)",
      { priceCents: 2237, promoPct: 20, promoType: "PERCENTAGE", promoEnd: null },
      { isPro: false },
      {
        unitPriceCents: 1790,
        baseCents: 2237,
        promo: { kind: "PERCENT", pct: 20 },
        cutOption: null,
      },
    ],
    [
      "1911 with a 15 % promotion is 1624 (1624,35 rounds down)",
      { priceCents: 1911, promoPct: 15, promoType: "PERCENTAGE", promoEnd: FUTURE },
      { isPro: false },
      {
        unitPriceCents: 1624,
        baseCents: 1911,
        promo: { kind: "PERCENT", pct: 15 },
        cutOption: null,
      },
    ],
    [
      "999 with a 50 % promotion is 500 (499,5 rounds up)",
      { priceCents: 999, promoPct: 50, promoType: "FLASH", promoEnd: FUTURE },
      { isPro: false },
      { unitPriceCents: 500, baseCents: 999, promo: { kind: "PERCENT", pct: 50 }, cutOption: null },
    ],
    [
      "a promotion that ended leaves the price untouched",
      { priceCents: 2237, promoPct: 20, promoType: "PERCENTAGE", promoEnd: PAST },
      { isPro: false },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "a fixed promotion",
      { priceCents: 1500, promoType: "FIXED_AMOUNT", promoFixedCents: 300 },
      { isPro: false },
      {
        unitPriceCents: 1200,
        baseCents: 1500,
        promo: { kind: "FIXED", cents: 300 },
        cutOption: null,
      },
    ],
    [
      "a fixed promotion larger than the price gives 0, never a negative price",
      { priceCents: 250, promoType: "FIXED_AMOUNT", promoFixedCents: 300 },
      { isPro: false },
      { unitPriceCents: 0, baseCents: 250, promo: { kind: "FIXED", cents: 300 }, cutOption: null },
    ],
    [
      "the pro price for a pro customer",
      product,
      { isPro: true },
      { unitPriceCents: 1500, baseCents: 1500, promo: null, cutOption: null },
    ],
    [
      "the public price for anybody else, even when a pro price is set",
      product,
      { isPro: false },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "the public price for a pro customer when no pro price is set",
      { priceCents: 2237, proPriceCents: null },
      { isPro: true },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "a pro price of 0 means 'not set', not 'free'",
      { priceCents: 2237, proPriceCents: 0 },
      { isPro: true },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "a product promotion applies on the pro price",
      { priceCents: 2237, proPriceCents: 1500, promoPct: 20, promoType: "PERCENTAGE" },
      { isPro: true },
      {
        unitPriceCents: 1200,
        baseCents: 1500,
        promo: { kind: "PERCENT", pct: 20 },
        cutOption: null,
      },
    ],
    [
      "a cut option replaces the public price",
      product,
      { isPro: false, cutOption: "Haché" },
      { unitPriceCents: 2100, baseCents: 2100, promo: null, cutOption: "Haché" },
    ],
    [
      "a cut option replaces the pro price",
      product,
      { isPro: true, cutOption: "Haché" },
      { unitPriceCents: 2100, baseCents: 2100, promo: null, cutOption: "Haché" },
    ],
    [
      "a product promotion applies on a cut price",
      { priceCents: 2237, cutOptions: CUTS, promoPct: 20, promoType: "PERCENTAGE", promoEnd: null },
      { isPro: false, cutOption: "Haché" },
      {
        unitPriceCents: 1680,
        baseCents: 2100,
        promo: { kind: "PERCENT", pct: 20 },
        cutOption: "Haché",
      },
    ],
    [
      "a fixed promotion applies on a cut price",
      { priceCents: 2237, cutOptions: CUTS, promoType: "FIXED_AMOUNT", promoFixedCents: 290 },
      { isPro: false, cutOption: "En cubes" },
      {
        unitPriceCents: 1500,
        baseCents: 1790,
        promo: { kind: "FIXED", cents: 290 },
        cutOption: "En cubes",
      },
    ],
    [
      "a null cut option is no cut option",
      product,
      { isPro: false, cutOption: null },
      { unitPriceCents: 2237, baseCents: 2237, promo: null, cutOption: null },
    ],
    [
      "a free product stays free",
      { priceCents: 0, promoPct: 20, promoType: "PERCENTAGE" },
      { isPro: false },
      { unitPriceCents: 0, baseCents: 0, promo: { kind: "PERCENT", pct: 20 }, cutOption: null },
    ],
  ])("%s", (_label, pricing, options, expected) => {
    const result = resolveUnitPrice(pricing, { ...options, now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({
      unitPriceCents: result.unitPriceCents,
      baseCents: result.baseCents,
      promo: result.promo,
      cutOption: result.cutOption === null ? null : result.cutOption.name,
    }).toEqual(expected);
  });

  it("should return the cut option found in the product, with its database price", () => {
    const result = resolveUnitPrice(product, { isPro: false, cutOption: "En cubes", now: NOW });
    expect(result).toEqual({
      ok: true,
      unitPriceCents: 1790,
      baseCents: 1790,
      promo: null,
      cutOption: { name: "En cubes", priceCents: 1790 },
    });
  });

  it.each<[string, ProductPricing, string]>([
    ["a name the product does not offer", product, "Émincé"],
    ["a different case", product, "haché"],
    ["surrounding spaces", product, " Haché "],
    ["an empty name", product, ""],
    ["a product without cut options", { priceCents: 2237 }, "Haché"],
    ["a product whose cut options are null", { priceCents: 2237, cutOptions: null }, "Haché"],
    ["a product whose cut options are empty", { priceCents: 2237, cutOptions: [] }, "Haché"],
  ])("should refuse an unknown cut option: %s", (_label, pricing, cutOption) => {
    expect(resolveUnitPrice(pricing, { isPro: true, cutOption, now: NOW })).toEqual({
      ok: false,
      error: "UNKNOWN_CUT_OPTION",
    });
  });

  // Stored before the product validators refused a cut option at 0 (C0-R10): such an option
  // would replace the price per kilogram by nothing.
  it.each<[string, ProductPricing]>([
    ["alone", { priceCents: 2237, cutOptions: [{ name: "Offert", priceCents: 0 }] }],
    [
      "beside priced options",
      { priceCents: 2237, cutOptions: [...CUTS, { name: "Offert", priceCents: 0 }] },
    ],
    [
      "with a product promotion",
      {
        priceCents: 2237,
        cutOptions: [{ name: "Offert", priceCents: 0 }],
        promoPct: 20,
        promoType: "PERCENTAGE",
      },
    ],
  ])("should refuse a cut option stored at 0 cents, %s", (_label, pricing) => {
    for (const isPro of [false, true]) {
      expect(resolveUnitPrice(pricing, { isPro, cutOption: "Offert", now: NOW })).toEqual({
        ok: false,
        error: "CUT_OPTION_UNPRICED",
      });
    }
  });

  it("should still price the other cut options of a product that has one at 0 cents", () => {
    const pricing = { priceCents: 2237, cutOptions: [{ name: "Offert", priceCents: 0 }, ...CUTS] };
    const result = resolveUnitPrice(pricing, { isPro: false, cutOption: "Haché", now: NOW });
    expect(result).toMatchObject({ ok: true, unitPriceCents: 2100 });
  });

  it("should give each refusal a French message", () => {
    expect(CUT_OPTION_ISSUE_MESSAGES).toEqual({
      UNKNOWN_CUT_OPTION: "découpe inconnue",
      CUT_OPTION_UNPRICED: "découpe indisponible",
    });
  });

  it("should throw TypeError when a cut option is requested on malformed cut options", () => {
    expect(() =>
      resolveUnitPrice(
        { priceCents: 2237, cutOptions: [{ name: "Haché" }] },
        { isPro: false, cutOption: "Haché", now: NOW }
      )
    ).toThrow(TypeError);
  });

  it.each([-1, 22.37, Number.NaN])(
    "should throw RangeError on a product price of %d",
    (priceCents) => {
      expect(() => resolveUnitPrice({ priceCents }, { isPro: false, now: NOW })).toThrow(
        RangeError
      );
    }
  );

  it("should throw RangeError on a pro price that is not whole cents", () => {
    expect(() =>
      resolveUnitPrice({ priceCents: 2237, proPriceCents: 15.5 }, { isPro: true, now: NOW })
    ).toThrow(RangeError);
  });

  it("should never return a negative or fractional price", () => {
    for (const priceCents of [0, 1, 99, 100, 999, 1911, 2237, 9999]) {
      for (let promoPct = 1; promoPct <= 99; promoPct += 1) {
        const result = resolveUnitPrice(
          { priceCents, promoPct, promoType: "PERCENTAGE" },
          { isPro: false, now: NOW }
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Number.isInteger(result.unitPriceCents)).toBe(true);
        expect(result.unitPriceCents).toBeGreaterThanOrEqual(0);
        expect(result.unitPriceCents).toBeLessThanOrEqual(priceCents);
        expect(result.unitPriceCents).toBe(Math.floor((priceCents * (100 - promoPct) + 50) / 100));
      }
    }
  });
});
