// @vitest-environment node
// The quantity of a stored order line reads the same on the butcher's ticket and in both
// customer e-mails: a weighed row stores KILOGRAMS in `quantity` and the grams of ONE portion
// in `weightGrams` (src/lib/pricing/line.ts), so 1 kg ordered as 500 g portions is 2 × 500 g.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

import type { KitchenOrder } from "@/hooks/use-order-polling";
import { buildTicketHtml, formatItemQty } from "@/components/boucher/OrderTicket";
import { fmtQty as confirmationQty } from "@/lib/emails/order-confirmation";
import { fmtQty as receiptQty } from "@/lib/emails/order-receipt";
import type { SaleUnit } from "@/lib/pricing/line";

type KitchenItem = KitchenOrder["items"][number];

const NBSP = " ";
const text = (s: string) => s.replace(/ /g, NBSP);

function kitchenItem(
  overrides: Partial<KitchenItem> & Pick<KitchenItem, "unit" | "quantity" | "weightGrams">
): KitchenItem {
  return {
    id: `item-${overrides.unit}-${overrides.quantity}`,
    productId: "product-1",
    name: "Entrecôte",
    priceCents: 2990,
    totalCents: 2990,
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

const CASES: ReadonlyArray<
  [label: string, unit: SaleUnit, quantity: number, weightGrams: number | null, expected: string]
> = [
  ["two 500 g portions (1 kg stored)", "KG", 1, 500, text("2 × 500 g")],
  ["one 500 g portion", "KG", 0.5, 500, text("500 g")],
  ["one 2 kg portion", "KG", 2, 2000, text("2 kg")],
  ["row re-weighed by the butcher", "KG", 0.47, 500, text("470 g")],
  ["legacy weighed row without portion weight", "KG", 1.5, null, text("1,5 kg")],
  ["three 200 g slice portions", "TRANCHE", 0.6, 200, text("3 × 200 g")],
  ["three pieces", "PIECE", 3, null, text("3 pièces")],
  ["one tray", "BARQUETTE", 1, null, text("1 barquette")],
];

describe("order line quantity on every printed or e-mailed support", () => {
  it.each(CASES)("%s", (_label, unit, quantity, weightGrams, expected) => {
    expect(formatItemQty(kitchenItem({ unit, quantity, weightGrams }))).toBe(expected);
    expect(
      confirmationQty({ name: "Entrecôte", unit, quantity, weightGrams, totalCents: 2990 })
    ).toBe(expected);
    expect(
      receiptQty({
        name: "Entrecôte",
        unit,
        quantity,
        weightGrams,
        totalCents: 2990,
        available: true,
        vatRate: 5.5,
      })
    ).toBe(expected);
  });

  it("reads the unit of the order line, not the product's current unit", () => {
    const item = kitchenItem({
      unit: "KG",
      quantity: 1,
      weightGrams: 500,
      product: { name: "Entrecôte", unit: "PIECE" },
    });
    expect(formatItemQty(item)).toBe(text("2 × 500 g"));
  });

  it("refuses a unit that no order line can carry", () => {
    expect(() =>
      formatItemQty(kitchenItem({ unit: "LITRE", quantity: 1, weightGrams: null }))
    ).toThrow(TypeError);
  });
});

describe("butcher ticket HTML", () => {
  const order: KitchenOrder = {
    id: "order-1",
    orderNumber: "KG26-000166",
    displayNumber: "#012",
    status: "ACCEPTED",
    totalCents: 6371,
    discountCents: 0,
    customerNumber: 12,
    isPro: false,
    customerNote: "Bien emballer",
    requestedTime: null,
    estimatedReady: "2026-11-13T11:30:00.000Z",
    actualReady: null,
    qrCode: "1a2b3c4d-0000-0000-0000-000000000000",
    paymentMethod: "ON_PICKUP",
    pickupSlotStart: null,
    createdAt: "2026-11-13T11:00:00.000Z",
    updatedAt: "2026-11-13T11:00:00.000Z",
    items: [
      kitchenItem({
        id: "a",
        name: "Entrecôte",
        unit: "KG",
        quantity: 1,
        weightGrams: 500,
        priceCents: 2990,
        totalCents: 2990,
      }),
      kitchenItem({
        id: "b",
        name: "Escalope",
        unit: "TRANCHE",
        quantity: 0.6,
        weightGrams: 200,
        priceCents: 1990,
        totalCents: 1194,
        sliceCount: 4,
      }),
      kitchenItem({
        id: "c",
        name: "Merguez",
        unit: "PIECE",
        quantity: 3,
        weightGrams: null,
        priceCents: 299,
        totalCents: 897,
        cutOption: "Fines",
      }),
      kitchenItem({
        id: "d",
        name: "Brochettes",
        unit: "BARQUETTE",
        quantity: 1,
        weightGrams: null,
        priceCents: 1290,
        totalCents: 1290,
      }),
    ],
    user: { firstName: "tarik", lastName: "benali" },
    priceAdjustment: null,
  };

  const html = buildTicketHtml(order, "Boucherie Test");

  it("prints each line's quantity before its name", () => {
    expect(html).toContain(`${text("2 × 500 g")} Entrecôte`);
    expect(html).toContain(`${text("3 × 200 g")} Escalope`);
    expect(html).toContain(`${text("3 pièces")} Merguez [Fines]`);
    expect(html).toContain(`${text("1 barquette")} Brochettes`);
  });

  it("prints the stored amounts unchanged", () => {
    for (const price of ["29,90 €", "11,94 €", "8,97 €", "12,90 €"]) {
      expect(html).toContain(`<span class="item-price">${price}</span>`);
    }
    expect(html).toContain("<span>Sous-total</span><span>63,71 €</span>");
  });

  it("asks for the amount at the counter on a pay-on-pickup order", () => {
    expect(html).toContain("<span>À régler sur place</span><span>63,71 €</span>");
    expect(html).not.toContain("Montant payé");
  });

  it("prints the amount as paid on an order paid online", () => {
    const online = buildTicketHtml({ ...order, paymentMethod: "ONLINE" }, "Boucherie Test");
    expect(online).toContain("<span>Montant payé</span><span>63,71 €</span>");
    expect(online).not.toContain("À régler sur place");
  });

  it("keeps the ticket header and customer name", () => {
    expect(html).toContain("#012");
    expect(html).toContain("Tarik.B");
    expect(html).toContain("Boucherie Test");
  });
});
