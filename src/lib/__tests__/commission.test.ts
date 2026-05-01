// @vitest-environment node
//
// Commission helper — controls how much each shop owes Klik&Go on each order.
// A wrong rounding here means real money lost on every transaction; we lock
// the contract.

import { describe, it, expect } from "vitest";
import { calculateCommission, getNetAmount } from "@/lib/commission";

describe("calculateCommission", () => {
  it("should return 0 when commission is disabled, regardless of pct or total", () => {
    // shopCommissionEnabled=false short-circuits before reading pct
    expect(calculateCommission(10_000, 5, false)).toBe(0);
    expect(calculateCommission(10_000, null, false)).toBe(0);
  });

  it("should fall back to the 5% default when pct is null/undefined", () => {
    // 100€ * 5% = 5€ = 500 cents
    expect(calculateCommission(10_000, null, true)).toBe(500);
    expect(calculateCommission(10_000, undefined, true)).toBe(500);
  });

  it("should honor the shop-specific commission percentage when provided", () => {
    // 100€ * 7% = 7€ = 700 cents
    expect(calculateCommission(10_000, 7, true)).toBe(700);
  });

  it("should round to the nearest cent (banker's rounding via Math.round)", () => {
    // 1234 cents * 5% = 61.7 → rounds to 62
    expect(calculateCommission(1234, 5, true)).toBe(62);
  });
});

describe("getNetAmount", () => {
  it("should subtract commission from total to compute the boucher payout", () => {
    expect(getNetAmount(10_000, 500)).toBe(9_500);
  });
});
