// @vitest-environment node
// What the butcher's adjustment window computes before sending: the request the server receives
// (only the lines he changed, never a line out of stock), the new order total as adjust-price.ts
// computes it, and the decision of decideAdjustment. The same scenarios run against the server on
// PostgreSQL in tests/integration/orders/price-adjust-preview-parity.test.ts.
import { describe, expect, it } from "vitest";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { draftFromInputs, previewAdjustment } from "@/components/boucher/price-adjust-preview";

type Item = KitchenOrder["items"][number];

function line(overrides: Partial<Item> & Pick<Item, "id" | "name">): Item {
  return {
    productId: `product-${overrides.id}`,
    quantity: 1,
    unit: "PIECE",
    priceCents: 450,
    totalCents: 450,
    estimatedPriceCents: 450,
    weightGrams: null,
    sliceCount: null,
    sliceThickness: null,
    variant: null,
    pieceCount: null,
    pieceLabel: null,
    cutOption: null,
    available: true,
    ...overrides,
  };
}

// 2 x 500 g of merguez at 20,00 €/kg, one bread, one sold-out tray. Estimated total 24,50 €:
// STANDARD tolerance = min(5 % x 24,50 €, 10 €) = 1,22 €.
const MERGUEZ = line({
  id: "a",
  name: "Merguez",
  unit: "KG",
  quantity: 1,
  weightGrams: 500,
  priceCents: 2000,
  totalCents: 2000,
  estimatedPriceCents: 2000,
});
const BREAD = line({ id: "b", name: "Pain" });
const TRAY = line({ id: "c", name: "Barquette", unit: "BARQUETTE", available: false });

function order(overrides: Partial<KitchenOrder> = {}) {
  return {
    totalCents: 2450,
    weighToleranceRateBps: 500,
    weighToleranceCapCents: 1000,
    estimatedTotalCents: 2450,
    items: [MERGUEZ, BREAD, TRAY],
    ...overrides,
  };
}

const weigh = (newQuantities: Record<string, number>) =>
  ({ adjustmentType: "WEIGHT", newQuantities }) as const;

describe("previewAdjustment", () => {
  it("applies a weighing within the customer's tolerance and sends only that line", () => {
    const preview = previewAdjustment(order(), weigh({ a: 1.05, b: 1 }));

    expect(preview).toEqual({
      ok: true,
      request: { adjustmentType: "WEIGHT", items: [{ orderItemId: "a", newQuantity: 1.05 }] },
      newTotalCents: 2550,
      maxTotalCents: 3675,
      decision: {
        decision: "APPLY",
        reason: "WITHIN_TOLERANCE",
        toleranceCents: 122,
        cumulatedIncreaseCents: 100,
      },
    });
  });

  it("asks the customer beyond his tolerance", () => {
    const preview = previewAdjustment(order(), weigh({ a: 1.1 }));

    expect(preview).toMatchObject({
      ok: true,
      newTotalCents: 2650,
      decision: { decision: "ASK", reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 200 },
    });
  });

  it("applies a decrease at once", () => {
    expect(previewAdjustment(order(), weigh({ a: 0.95 }))).toMatchObject({
      ok: true,
      newTotalCents: 2350,
      decision: { decision: "APPLY", reason: "DECREASE" },
    });
  });

  it("measures the increase cumulated since the order, not the last step", () => {
    const weighed = { ...MERGUEZ, quantity: 1.05, totalCents: 2100 };
    const adjusted = order({ totalCents: 2550, items: [weighed, BREAD, TRAY] });

    expect(previewAdjustment(adjusted, weigh({ a: 1.06 }))).toMatchObject({
      decision: { reason: "WITHIN_TOLERANCE", cumulatedIncreaseCents: 120 },
    });
    expect(previewAdjustment(adjusted, weigh({ a: 1.07 }))).toMatchObject({
      decision: { reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 140 },
    });
  });

  it("asks the customer for any increase on an order created before the tolerance", () => {
    const legacy = order({
      weighToleranceRateBps: null,
      weighToleranceCapCents: null,
      estimatedTotalCents: null,
    });

    expect(previewAdjustment(legacy, weigh({ a: 1.01 }))).toMatchObject({
      decision: { decision: "ASK", reason: "NO_TOLERANCE", toleranceCents: 0 },
    });
  });

  it("asks the customer for a new unit price that raises the total", () => {
    const preview = previewAdjustment(order(), {
      adjustmentType: "PRICE",
      newPricesCents: { a: 2000, b: 500 },
    });

    expect(preview).toMatchObject({
      ok: true,
      request: { adjustmentType: "PRICE", items: [{ orderItemId: "b", newPriceCents: 500 }] },
      newTotalCents: 2500,
      decision: { decision: "ASK", reason: "NOT_WEIGHING" },
    });
  });

  it("asks the customer for a higher total typed by hand, applies a lower one", () => {
    expect(previewAdjustment(order(), { adjustmentType: "MANUAL", newTotalCents: 2500 })).toEqual({
      ok: true,
      request: { adjustmentType: "MANUAL", newTotalCents: 2500 },
      newTotalCents: 2500,
      maxTotalCents: 3675,
      decision: {
        decision: "ASK",
        reason: "NOT_WEIGHING",
        toleranceCents: 122,
        cumulatedIncreaseCents: 0,
      },
    });
    expect(
      previewAdjustment(order(), { adjustmentType: "MANUAL", newTotalCents: 2400 })
    ).toMatchObject({ decision: { decision: "APPLY", reason: "DECREASE" } });
  });

  it("never sends a line out of stock, and lets it give no room to the others", () => {
    const preview = previewAdjustment(order(), weigh({ c: 3 }));

    expect(preview).toMatchObject({
      ok: true,
      request: { adjustmentType: "WEIGHT", items: [] },
      newTotalCents: 2450,
    });
  });

  it("names the line whose weight is not in whole grams, or whose count is not whole", () => {
    expect(previewAdjustment(order(), weigh({ a: 1.0505 }))).toEqual({
      ok: false,
      itemId: "a",
      message: "Merguez : quantité invalide (poids au gramme près, pièces sans décimale)",
    });
    expect(previewAdjustment(order(), weigh({ b: 1.5 }))).toMatchObject({ ok: false, itemId: "b" });
    expect(previewAdjustment(order(), weigh({ a: Number.NaN }))).toMatchObject({
      ok: false,
      itemId: "a",
    });
  });

  it("refuses a price or a total that is not a whole, non-negative number of cents", () => {
    expect(
      previewAdjustment(order(), { adjustmentType: "PRICE", newPricesCents: { b: -1 } })
    ).toEqual({ ok: false, itemId: "b", message: "Pain : prix invalide" });
    expect(
      previewAdjustment(order(), { adjustmentType: "MANUAL", newTotalCents: Number.NaN })
    ).toEqual({ ok: false, itemId: null, message: "Montant invalide" });
    const absurd = { ...BREAD, quantity: 99, totalCents: 44_550, estimatedPriceCents: 44_550 };
    expect(
      previewAdjustment(order({ totalCents: 46_550, items: [MERGUEZ, absurd] }), {
        adjustmentType: "PRICE",
        newPricesCents: { b: 99_999_999_999_999 },
      })
    ).toEqual({ ok: false, itemId: "b", message: "Pain : prix invalide" });
  });

  it("reports the platform's cap on an increase (+50 % of the current total)", () => {
    expect(previewAdjustment(order(), weigh({ a: 1.9 }))).toMatchObject({
      ok: true,
      newTotalCents: 4250,
      maxTotalCents: 3675,
    });
  });

  it("reads the fields as typed: a decimal comma or dot, euros in cents, empty as invalid", () => {
    const inputs = {
      weights: { a: "1,05", b: " 2 " },
      prices: { a: "20", b: "4,99" },
      total: "26.5",
    };

    expect(draftFromInputs("WEIGHT", inputs)).toEqual({
      adjustmentType: "WEIGHT",
      newQuantities: { a: 1.05, b: 2 },
    });
    expect(draftFromInputs("PRICE", inputs)).toEqual({
      adjustmentType: "PRICE",
      newPricesCents: { a: 2000, b: 499 },
    });
    expect(draftFromInputs("MANUAL", inputs)).toEqual({
      adjustmentType: "MANUAL",
      newTotalCents: 2650,
    });
    expect(
      previewAdjustment(order(), draftFromInputs("WEIGHT", { ...inputs, weights: { a: "" } }))
    ).toMatchObject({ ok: false, itemId: "a" });
  });

  it("reads a kitchen row without the tolerance fields as a legacy order", () => {
    const bare = { totalCents: 450, items: [{ ...BREAD, estimatedPriceCents: undefined }] };

    expect(previewAdjustment(bare, weigh({ b: 2 }))).toMatchObject({
      decision: { decision: "ASK", reason: "NO_TOLERANCE", cumulatedIncreaseCents: null },
    });
  });
});
