// tests/lib/cart-utils.test.ts — Cart price calculation tests
import { describe, it, expect } from "vitest";

// ── Pure functions extracted from use-cart.tsx for testing ──

interface CartItem {
  id: string;
  name: string;
  unit: "KG" | "PIECE" | "BARQUETTE" | "TRANCHE";
  priceCents: number;
  quantity: number;
  weightGrams?: number;
  cutPriceCents?: number;
}

/** Matches the totalCents calculation in use-cart.tsx line 271-281 */
function computeTotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const effectivePrice = item.cutPriceCents ?? item.priceCents;
    if ((item.unit === "KG" || item.unit === "TRANCHE") && item.weightGrams) {
      return sum + Math.round((item.weightGrams / 1000) * effectivePrice) * item.quantity;
    }
    return sum + effectivePrice * item.quantity;
  }, 0);
}

/** Matches the itemCount calculation in use-cart.tsx line 269 */
function computeItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

/** Matches formatPrice in src/lib/utils.ts */
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

// ── Tests ──

describe("computeTotalCents", () => {
  it("calculates total for PIECE items", () => {
    const items: CartItem[] = [
      { id: "1", name: "Merguez", unit: "PIECE", priceCents: 500, quantity: 3 },
    ];
    expect(computeTotalCents(items)).toBe(1500); // 5€ × 3 = 15€
  });

  it("calculates total for KG items with weight", () => {
    const items: CartItem[] = [
      { id: "1", name: "Entrecôte", unit: "KG", priceCents: 2990, quantity: 1, weightGrams: 500 },
    ];
    // 500g of 29.90€/kg = (500/1000) × 2990 = 1495 cents
    expect(computeTotalCents(items)).toBe(1495);
  });

  it("calculates total for KG items without weight (falls back to quantity×price)", () => {
    const items: CartItem[] = [
      { id: "1", name: "Poulet", unit: "KG", priceCents: 899, quantity: 2 },
    ];
    // No weightGrams → priceCents × quantity
    expect(computeTotalCents(items)).toBe(1798);
  });

  it("uses cutPriceCents when available (découpe option)", () => {
    const items: CartItem[] = [
      { id: "1", name: "Côtelettes", unit: "KG", priceCents: 1990, cutPriceCents: 2290, quantity: 1, weightGrams: 1000 },
    ];
    // cutPriceCents overrides priceCents: 1000g × 22.90€/kg = 2290
    expect(computeTotalCents(items)).toBe(2290);
  });

  it("handles TRANCHE with weight", () => {
    const items: CartItem[] = [
      { id: "1", name: "Foie", unit: "TRANCHE", priceCents: 3500, quantity: 1, weightGrams: 250 },
    ];
    // 250g of 35€/kg = (250/1000) × 3500 = 875
    expect(computeTotalCents(items)).toBe(875);
  });

  it("calculates mixed cart correctly", () => {
    const items: CartItem[] = [
      { id: "1", name: "Merguez", unit: "PIECE", priceCents: 500, quantity: 2 },
      { id: "2", name: "Entrecôte", unit: "KG", priceCents: 2990, quantity: 1, weightGrams: 750 },
      { id: "3", name: "Barquette kebab", unit: "BARQUETTE", priceCents: 1200, quantity: 1 },
    ];
    // Merguez: 500 × 2 = 1000
    // Entrecôte: (750/1000) × 2990 = 2242.5 → Math.round = 2243 × 1 = 2243
    // Kebab: 1200 × 1 = 1200
    expect(computeTotalCents(items)).toBe(1000 + 2243 + 1200);
  });

  it("returns 0 for empty cart", () => {
    expect(computeTotalCents([])).toBe(0);
  });

  it("handles quantity > 1 for KG items (multiple identical cuts)", () => {
    const items: CartItem[] = [
      { id: "1", name: "Steak haché", unit: "KG", priceCents: 1590, quantity: 2, weightGrams: 300 },
    ];
    // (300/1000) × 1590 = 477 × 2 = 954
    expect(computeTotalCents(items)).toBe(954);
  });

  it("rounds correctly for fractional weight calculations", () => {
    const items: CartItem[] = [
      { id: "1", name: "Agneau", unit: "KG", priceCents: 2499, quantity: 1, weightGrams: 333 },
    ];
    // (333/1000) × 2499 = 832.167 → Math.round = 832
    expect(computeTotalCents(items)).toBe(832);
  });
});

describe("computeItemCount", () => {
  it("sums quantities", () => {
    const items: CartItem[] = [
      { id: "1", name: "A", unit: "PIECE", priceCents: 100, quantity: 3 },
      { id: "2", name: "B", unit: "PIECE", priceCents: 200, quantity: 2 },
    ];
    expect(computeItemCount(items)).toBe(5);
  });

  it("returns 0 for empty cart", () => {
    expect(computeItemCount([])).toBe(0);
  });
});

describe("formatPrice", () => {
  it("formats cents to EUR with comma separator", () => {
    expect(formatPrice(1500)).toBe("15,00 €");
    expect(formatPrice(999)).toBe("9,99 €");
    expect(formatPrice(0)).toBe("0,00 €");
    expect(formatPrice(50)).toBe("0,50 €");
    expect(formatPrice(10000)).toBe("100,00 €");
  });

  it("handles single-digit cents", () => {
    expect(formatPrice(1)).toBe("0,01 €");
    expect(formatPrice(5)).toBe("0,05 €");
  });
});
