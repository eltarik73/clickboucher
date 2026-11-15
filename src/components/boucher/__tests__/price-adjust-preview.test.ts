// @vitest-environment node
// What the butcher's adjustment window reads from its fields: the request the server receives
// (only the values he changed, a decimal comma or dot, euros in cents), nothing while no field
// differs from the order, and the plan of planAdjustment for that request. The planner's own
// rules (new totals, refusals, decision) are tested in src/lib/__tests__/pricing-adjustment-*.
import { describe, expect, it } from "vitest";
import { previewAdjustment, type TypedInputs } from "@/components/boucher/price-adjust-preview";
import { kitchenOrder } from "./kitchen-order-fixtures";

// The window's fields as it opens on kitchenOrder(): the stored values, as it seeds them.
const AS_STORED: TypedInputs = {
  weights: { a: "1", b: "1" },
  prices: { a: "20.00", b: "4.50" },
  total: "24.50",
};

const typed = (changes: Partial<TypedInputs>): TypedInputs => ({ ...AS_STORED, ...changes });

describe("previewAdjustment", () => {
  it.each(["WEIGHT", "PRICE", "MANUAL"] as const)(
    "has nothing to plan while the %s fields hold the stored values",
    (tab) => {
      expect(previewAdjustment(kitchenOrder(), tab, AS_STORED)).toBeNull();
    }
  );

  it("has nothing to plan while the total field is empty", () => {
    expect(previewAdjustment(kitchenOrder(), "MANUAL", typed({ total: " " }))).toBeNull();
  });

  it("sends only the weight that changed, typed with a decimal comma", () => {
    const preview = previewAdjustment(
      kitchenOrder(),
      "WEIGHT",
      typed({ weights: { a: "1,05", b: " 1 " } })
    );

    expect(preview?.request).toEqual({
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: "a", newQuantity: 1.05 }],
    });
    expect(preview?.plan).toMatchObject({ ok: true, newTotalCents: 2550 });
  });

  it("sends only the unit price that changed, in cents, typed with a dot or a comma", () => {
    const preview = previewAdjustment(
      kitchenOrder(),
      "PRICE",
      typed({ prices: { a: "20", b: "4,99" } })
    );

    expect(preview?.request).toEqual({
      adjustmentType: "PRICE",
      items: [{ orderItemId: "b", newPriceCents: 499 }],
    });
    expect(preview?.plan).toMatchObject({ ok: true, newTotalCents: 2499 });
  });

  it("sends the total typed by hand, in cents", () => {
    const preview = previewAdjustment(kitchenOrder(), "MANUAL", typed({ total: "26.5" }));

    expect(preview?.request).toEqual({ adjustmentType: "MANUAL", newTotalCents: 2650 });
    expect(preview?.plan).toMatchObject({ ok: true, newTotalCents: 2650 });
  });

  it.each(["abc", ""])("plans a weight typed %j as a refusal naming its line", (weight) => {
    const preview = previewAdjustment(kitchenOrder(), "WEIGHT", typed({ weights: { a: weight } }));

    expect(preview?.plan).toEqual({
      ok: false,
      reason: "QUANTITY_INVALID",
      orderItemId: "a",
      message:
        "Merguez : Quantité invalide : poids en grammes entiers, nombre entier pour les pièces",
    });
  });

  it("plans a total that is not a number as an invalid amount", () => {
    expect(previewAdjustment(kitchenOrder(), "MANUAL", typed({ total: "vingt" }))?.plan).toEqual({
      ok: false,
      reason: "TOTAL_INVALID",
      orderItemId: null,
      message: "Montant invalide",
    });
  });
});
