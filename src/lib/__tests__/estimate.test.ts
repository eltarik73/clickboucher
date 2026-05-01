// @vitest-environment node
//
// Estimation helpers — convert a quantity in grams + a category into a
// "≈N personnes / ≈X pièces" hint shown on every product card. These ship
// pure logic from src/lib/estimate.ts.

import { describe, it, expect } from "vitest";
import {
  computeEstimation,
  formatEstimationShort,
  computePrice,
  formatWeight,
} from "@/lib/estimate";

describe("computeEstimation", () => {
  it("should compute number of personnes from quantity + category portion size", () => {
    // viande_hachee: 150g per personne (standard profile). 600g → 4 pers.
    const e = computeEstimation(600, "viande_hachee", "standard");
    expect(e.personnes.exact).toBeCloseTo(4, 5);
    expect(e.personnes.min).toBe(4);
    expect(e.personnes.max).toBe(4);
    // viande_hachee has no nomPiece → pieces is null
    expect(e.pieces).toBeNull();
  });

  it("should also report pieces count + label for piece-based categories", () => {
    // merguez weighs ~60g each → 600g ≈ 10 merguez
    const e = computeEstimation(600, "merguez", "standard");
    expect(e.pieces).not.toBeNull();
    expect(e.pieces?.count).toBe(10);
    // merguez plural is "merguez" (invariant) per CONVERSION_RULES
    expect(e.pieces?.nom).toBe("merguez");
  });

  it("should return min<max for in-between quantities (smartRound)", () => {
    // 500g viande_hachee at 150g/pers = 3.33 pers → min 3, max 4
    const e = computeEstimation(500, "viande_hachee", "standard");
    expect(e.personnes.min).toBe(3);
    expect(e.personnes.max).toBe(4);
  });
});

describe("formatEstimationShort", () => {
  it("should render the compact form '≈N pers.' when min === max", () => {
    const e = computeEstimation(600, "viande_hachee", "standard");
    expect(formatEstimationShort(e)).toBe("≈4 pers.");
  });

  it("should prefer the pieces-based form when a category has piece weight", () => {
    const e = computeEstimation(600, "merguez", "standard");
    expect(formatEstimationShort(e)).toBe("≈10 merguez");
  });
});

describe("computePrice", () => {
  it("should compute total price from grams + €/kg, rounded to 2 decimals", () => {
    // 500g at 20€/kg = 10€
    expect(computePrice(500, 20)).toBe(10);
    // 333g at 24€/kg = 7.992 → 7.99 €
    expect(computePrice(333, 24)).toBe(7.99);
  });
});

describe("formatWeight (estimate)", () => {
  it("should render integer kg without decimals (e.g. '2kg' not '2.0kg')", () => {
    expect(formatWeight(2000)).toBe("2kg");
  });

  it("should render fractional kg with French comma", () => {
    expect(formatWeight(1500)).toBe("1,5kg");
  });

  it("should keep grams under 1kg as 'Ng' (no space)", () => {
    expect(formatWeight(500)).toBe("500g");
  });
});
