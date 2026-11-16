// A kitchen order as GET /api/boucher/orders/kitchen sends it, for the tests of the butcher's price
// adjustment window and of the tolerance line of his ticket: 2 x 500 g of merguez at 20,00 €/kg
// (1 kg stored), one bread at 4,50 €, one sold-out tray. Estimated total 24,50 €, STANDARD
// tolerance: min(5 % x 24,50 €, 10,00 €) = 1,22 € of weighing increase without asking.
import type { KitchenOrder } from "@/hooks/use-order-polling";

type KitchenItem = KitchenOrder["items"][number];

/** A line ordered at its estimate: one piece at 4,50 € unless overridden. */
export function kitchenLine(
  overrides: Partial<KitchenItem> & Pick<KitchenItem, "id" | "name">
): KitchenItem {
  const unit = overrides.unit ?? "PIECE";
  return {
    productId: `product-${overrides.id}`,
    quantity: 1,
    unit,
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
    product: { name: overrides.name, unit, imageUrl: null },
    ...overrides,
  };
}

export const MERGUEZ = kitchenLine({
  id: "a",
  name: "Merguez",
  unit: "KG",
  quantity: 1,
  weightGrams: 500,
  priceCents: 2000,
  totalCents: 2000,
  estimatedPriceCents: 2000,
});
export const BREAD = kitchenLine({ id: "b", name: "Pain" });
export const SOLD_OUT_TRAY = kitchenLine({
  id: "c",
  name: "Barquette épuisée",
  unit: "BARQUETTE",
  available: false,
});

export function kitchenOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: "order-1",
    orderNumber: "KG26-000201",
    displayNumber: "#021",
    status: "PREPARING",
    totalCents: 2450,
    discountCents: 0,
    weighToleranceRateBps: 500,
    weighToleranceCapCents: 1000,
    estimatedTotalCents: 2450,
    customerNumber: null,
    isPro: false,
    customerNote: null,
    requestedTime: null,
    estimatedReady: null,
    actualReady: null,
    qrCode: null,
    paymentMethod: "ON_PICKUP",
    pickupSlotStart: null,
    createdAt: "2026-11-15T10:00:00.000Z",
    updatedAt: "2026-11-15T10:00:00.000Z",
    items: [MERGUEZ, BREAD, SOLD_OUT_TRAY],
    user: { firstName: "Zoé", lastName: "Martin", phone: null, loyaltyBadge: null },
    priceAdjustment: null,
    ...overrides,
  };
}
