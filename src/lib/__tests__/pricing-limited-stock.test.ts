// @vitest-environment node
//
// Stock left of an anti-gaspi or flash-sale product, as the storefront shows it.
// A limited product whose counter reaches 0 stays in its mode at 0 (the server
// refuses it at the quote). The storefront used to print « Plus que 0 ! » and let
// the customer add it, so every cart holding it was blocked at the quote.

import { describe, it, expect } from "vitest";
import {
  LOW_LIMITED_STOCK,
  limitedStockLowCount,
  limitedStockRemaining,
  limitedStockSoldOut,
  type LimitedStockFields,
} from "@/lib/pricing/limited-stock";

const plain: LimitedStockFields = {
  isAntiGaspi: false,
  antiGaspiStock: null,
  isFlashSale: false,
  flashSaleStock: null,
};

describe("limitedStockRemaining", () => {
  it("is null for a product without limited mode", () => {
    expect(limitedStockRemaining(plain)).toBeNull();
    expect(limitedStockRemaining({})).toBeNull();
  });

  it("is null for a limited mode without counter (unlimited quantity)", () => {
    expect(limitedStockRemaining({ ...plain, isAntiGaspi: true })).toBeNull();
    expect(limitedStockRemaining({ ...plain, isFlashSale: true })).toBeNull();
  });

  it("reads the anti-gaspi counter while the product is anti-gaspi", () => {
    expect(limitedStockRemaining({ ...plain, isAntiGaspi: true, antiGaspiStock: 3 })).toBe(3);
  });

  it("reads the flash-sale counter while the product is on flash sale", () => {
    expect(limitedStockRemaining({ ...plain, isFlashSale: true, flashSaleStock: 2 })).toBe(2);
  });

  it("ignores a counter whose mode is off, as the server does", () => {
    expect(limitedStockRemaining({ ...plain, antiGaspiStock: 0 })).toBeNull();
    expect(limitedStockRemaining({ ...plain, flashSaleStock: 0 })).toBeNull();
  });

  it("takes the smaller counter when both modes are on", () => {
    const both = { isAntiGaspi: true, antiGaspiStock: 4, isFlashSale: true, flashSaleStock: 1 };
    expect(limitedStockRemaining(both)).toBe(1);
    expect(limitedStockRemaining({ ...both, flashSaleStock: null })).toBe(4);
  });

  it("never goes below 0", () => {
    expect(limitedStockRemaining({ ...plain, isAntiGaspi: true, antiGaspiStock: -2 })).toBe(0);
  });
});

describe("limitedStockSoldOut", () => {
  it("is true for an anti-gaspi product at 0", () => {
    expect(limitedStockSoldOut({ ...plain, isAntiGaspi: true, antiGaspiStock: 0 })).toBe(true);
  });

  it("is true for a flash-sale product at 0", () => {
    expect(limitedStockSoldOut({ ...plain, isFlashSale: true, flashSaleStock: 0 })).toBe(true);
  });

  it("is true when one of two limited modes is at 0", () => {
    expect(
      limitedStockSoldOut({
        isAntiGaspi: true,
        antiGaspiStock: 5,
        isFlashSale: true,
        flashSaleStock: 0,
      })
    ).toBe(true);
  });

  it("is false with stock left, without counter, or without limited mode", () => {
    expect(limitedStockSoldOut({ ...plain, isAntiGaspi: true, antiGaspiStock: 1 })).toBe(false);
    expect(limitedStockSoldOut({ ...plain, isAntiGaspi: true })).toBe(false);
    expect(limitedStockSoldOut({ ...plain, antiGaspiStock: 0 })).toBe(false);
    expect(limitedStockSoldOut(plain)).toBe(false);
  });
});

describe("limitedStockLowCount", () => {
  it("gives the count to print « Plus que N » from 1 to the threshold", () => {
    expect(LOW_LIMITED_STOCK).toBe(5);
    expect(limitedStockLowCount({ ...plain, isAntiGaspi: true, antiGaspiStock: 1 })).toBe(1);
    expect(limitedStockLowCount({ ...plain, isFlashSale: true, flashSaleStock: 5 })).toBe(5);
  });

  it("is null at 0: a sold-out product never shows « Plus que 0 »", () => {
    expect(limitedStockLowCount({ ...plain, isAntiGaspi: true, antiGaspiStock: 0 })).toBeNull();
    expect(limitedStockLowCount({ ...plain, isFlashSale: true, flashSaleStock: 0 })).toBeNull();
  });

  it("is null above the threshold and without limited stock", () => {
    expect(limitedStockLowCount({ ...plain, isAntiGaspi: true, antiGaspiStock: 6 })).toBeNull();
    expect(limitedStockLowCount({ ...plain, isAntiGaspi: true })).toBeNull();
    expect(limitedStockLowCount(plain)).toBeNull();
  });
});
