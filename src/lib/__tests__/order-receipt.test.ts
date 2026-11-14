// @vitest-environment node
// The receipt e-mailed at pickup and the butcher's 80 mm ticket print the amount the order really
// costs: Order.totalCents, never the sum of every line. Before, both summed all lines — an
// out-of-stock line was billed, a promo code or a manual adjustment was ignored (order
// KG26-000194: stored 16,34 €, receipt "TOTAL TTC 35,11 €").
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

import type { KitchenOrder } from "@/hooks/use-order-polling";
import { buildTicketHtml } from "@/components/boucher/OrderTicket";
import {
  buildOrderReceiptEmail,
  type ReceiptData,
  type ReceiptItem,
} from "@/lib/emails/order-receipt";
import { summarizeReceipt, vatBreakdown } from "@/lib/pricing/receipt";

const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

function line(name: string, totalCents: number, overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return {
    name,
    unit: "PIECE",
    quantity: 1,
    weightGrams: null,
    totalCents,
    available: true,
    vatRate: 5.5,
    ...overrides,
  };
}

function receiptData(overrides: Partial<ReceiptData>): ReceiptData {
  return {
    orderId: "order-1",
    displayNumber: "#012",
    customerFirstName: "Fatima",
    customerLastName: "Amrani",
    customerNumber: "C-012",
    items: [],
    totalCents: 0,
    discountCents: 0,
    serviceFeeCents: 0,
    shopName: "Boucherie Test",
    shopAddress: "1 rue des Tests",
    shopCity: "Chambéry",
    shopSiret: null,
    shopFullAddress: null,
    paymentMethod: "ON_PICKUP",
    createdAt: new Date("2026-11-13T11:00:00Z"),
    pickedUpAt: new Date("2026-11-13T12:00:00Z"),
    ...overrides,
  };
}

/** The amount printed on the TOTAL TTC row of the e-mail. */
function printedTotal(html: string): string {
  const match = html.match(/TOTAL TTC<\/td>\s*<td[^>]*>([^<]+)<\/td>/);
  if (match === null) throw new Error("TOTAL TTC row not found");
  return match[1];
}

/** KG26-000194: one line out of stock, its replacement, and a 2,75 € code. */
const DISCOUNTED_WITH_REMOVED_LINE = receiptData({
  items: [
    line("Entrecôte", 1489),
    line("Côtes d'agneau", 1777, { available: false }),
    line("Merguez", 620, { vatRate: 20 }),
    line("Bavette (remplace)", 0, { available: false }),
  ],
  totalCents: 1489 + 620 - 275,
  discountCents: 275,
});

describe("receipt e-mail", () => {
  it("a discounted order with an out-of-stock line: total = Order.totalCents, discount printed, line not billed", () => {
    const { html } = buildOrderReceiptEmail(DISCOUNTED_WITH_REMOVED_LINE);

    expect(printedTotal(html)).toBe(euros(1834));
    expect(html).toContain(`${euros(-275)}`);
    expect(html).toContain("Remise");
    expect(html).toContain("Côtes d'agneau — non fourni");
    expect(html).not.toContain(euros(1777));
    expect(html).not.toContain(euros(1489 + 1777 + 620));
  });

  it("an adjusted order prints the adjustment and the adjusted total", () => {
    const { html } = buildOrderReceiptEmail(
      receiptData({ items: [line("Gigot", 3398)], totalCents: 3908 })
    );

    expect(printedTotal(html)).toBe(euros(3908));
    expect(html).toContain("Ajustement du prix");
    expect(html).toContain(euros(510));
  });

  it("an order paid online adds its service fee to the total; a pay-on-pickup order never does", () => {
    const online = buildOrderReceiptEmail(
      receiptData({
        items: [line("Gigot", 3398)],
        totalCents: 3398,
        serviceFeeCents: 99,
        paymentMethod: "ONLINE",
      })
    );
    const legacyOnPickup = buildOrderReceiptEmail(
      receiptData({ items: [line("Gigot", 3398)], totalCents: 3398, serviceFeeCents: 99 })
    );

    expect(printedTotal(online.html)).toBe(euros(3497));
    expect(printedTotal(legacyOnPickup.html)).toBe(euros(3398));
    expect(legacyOnPickup.html).not.toContain("Frais de service");
  });

  it("the VAT rows add up to the goods total, the discount prorated per rate", () => {
    const data = DISCOUNTED_WITH_REMOVED_LINE;
    const summary = summarizeReceipt({ ...data, lines: data.items });
    const groups = vatBreakdown(summary.lines, summary.goodsTotalCents);

    expect(groups.map((group) => group.rate)).toEqual([20, 5.5]);
    expect(groups.reduce((sum, group) => sum + group.ttcCents, 0)).toBe(1834);
    // 1834 x 620 / 2109 = 539,15 -> 539 ; 1834 x 1489 / 2109 = 1294,85 -> 1295 (plus grand reste).
    expect(groups).toEqual([
      { rate: 20, ttcCents: 539, htCents: 449, vatCents: 90 },
      { rate: 5.5, ttcCents: 1295, htCents: 1227, vatCents: 68 },
    ]);
  });

  it("refuses a positive total with no sold line to attribute its VAT to", () => {
    expect(() => vatBreakdown([], 500)).toThrow(RangeError);
    expect(vatBreakdown([], 0)).toEqual([]);
  });
});

type KitchenItem = KitchenOrder["items"][number];

function kitchenItem(id: string, name: string, totalCents: number, available = true): KitchenItem {
  return {
    id,
    productId: `product-${id}`,
    name,
    quantity: 1,
    unit: "PIECE",
    priceCents: totalCents,
    totalCents,
    weightGrams: null,
    sliceCount: null,
    sliceThickness: null,
    variant: null,
    pieceCount: null,
    pieceLabel: null,
    cutOption: null,
    available,
  };
}

function kitchenOrder(overrides: Partial<KitchenOrder>): KitchenOrder {
  return {
    id: "order-1",
    orderNumber: "KG26-000194",
    displayNumber: "#012",
    status: "ACCEPTED",
    totalCents: 0,
    discountCents: 0,
    customerNumber: 12,
    isPro: false,
    customerNote: null,
    requestedTime: null,
    estimatedReady: null,
    actualReady: null,
    qrCode: null,
    paymentMethod: "ON_PICKUP",
    pickupSlotStart: null,
    createdAt: "2026-11-13T11:00:00.000Z",
    updatedAt: "2026-11-13T11:00:00.000Z",
    items: [],
    user: { firstName: "fatima", lastName: "amrani" },
    priceAdjustment: null,
    ...overrides,
  };
}

describe("butcher ticket", () => {
  const html = buildTicketHtml(
    kitchenOrder({
      items: [
        kitchenItem("a", "Entrecôte", 1489),
        kitchenItem("b", "Côtelettes", 1777, false),
        kitchenItem("c", "Merguez", 620),
      ],
      totalCents: 1834,
      discountCents: 275,
    }),
    "Boucherie Test"
  );

  it("marks an out-of-stock line RUPTURE, without a price and outside the subtotal", () => {
    expect(html).toMatch(
      /item-out">\s*<div class="item-line"><span>[^<]*Côtelettes<\/span><span class="item-price">RUPTURE<\/span>/
    );
    expect(html).not.toContain(euros(1777));
    expect(html).toContain(`<span>Sous-total</span><span>${euros(2109)}</span>`);
  });

  it("prints the discount and asks for Order.totalCents", () => {
    expect(html).toContain(`<span>Remise</span><span>${euros(-275)}</span>`);
    expect(html).toContain(`<span>À régler sur place</span><span>${euros(1834)}</span>`);
  });

  it("prints an adjustment when the total was changed after the order was placed", () => {
    const adjusted = buildTicketHtml(
      kitchenOrder({ items: [kitchenItem("a", "Gigot", 3398)], totalCents: 3908 }),
      "Boucherie Test"
    );
    expect(adjusted).toContain(`<span>Ajustement</span><span>${euros(510)}</span>`);
    expect(adjusted).toContain(`<span>À régler sur place</span><span>${euros(3908)}</span>`);
  });
});
