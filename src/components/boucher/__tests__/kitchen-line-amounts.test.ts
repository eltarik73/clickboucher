// Le mode cuisine imprime le total stocké de chaque ligne (OrderItem.totalCents), jamais un montant
// recalculé « prix × quantité » : une ligne légitimement à 0 € (poids ajusté à rien) affiche
// 0,00 €, et un prix ne se calcule que dans src/lib/pricing. Les deux gardes de source
// interdisent la multiplication et le repli sur un total stocké.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { sourceFiles } from "../../../../tests/lib/source-files";

const ROOT = path.resolve(__dirname, "../../../..");

const KITCHEN_FILES = [
  "src/components/boucher/KitchenOrderCard.tsx",
  "src/components/boucher/OrderAlertOverlay.tsx",
  ...sourceFiles("src/app/(boucher)/boucher/commandes").filter((file) => file.endsWith(".tsx")),
];

const source = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

function pieceLine(id: string, name: string, priceCents: number, totalCents: number) {
  return {
    id,
    productId: `product-${id}`,
    name,
    quantity: 1,
    unit: "PIECE",
    priceCents,
    totalCents,
    weightGrams: null,
    sliceCount: null,
    sliceThickness: null,
    variant: null,
    pieceCount: null,
    pieceLabel: null,
    cutOption: null,
    available: true,
    product: { name, unit: "PIECE", imageUrl: null },
  } satisfies KitchenOrder["items"][number];
}

const ORDER: KitchenOrder = {
  id: "order-1",
  orderNumber: "KG26-000194",
  displayNumber: "#012",
  status: "ACCEPTED",
  totalCents: 1500,
  discountCents: 0,
  customerNumber: null,
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
  items: [pieceLine("a", "Gigot", 2990, 0), pieceLine("b", "Merguez", 1500, 1500)],
  user: { firstName: "fatima", lastName: "amrani", phone: null, loyaltyBadge: null },
  priceAdjustment: null,
};

afterEach(cleanup);

describe("kitchen line amounts", () => {
  it.each(KITCHEN_FILES)("%s never multiplies a price by a quantity", (file) => {
    expect(source(file)).not.toMatch(/priceCents\s*\*|\*\s*[\w.?]*priceCents/);
  });

  it.each(KITCHEN_FILES)("%s never replaces a stored total by a fallback", (file) => {
    expect(source(file)).not.toMatch(/totalCents\s*(\|\||\?\?)/);
  });

  it("the kitchen card prints each line's stored total, 0,00 € included", () => {
    render(
      createElement(KitchenOrderCard, { order: ORDER, onAction: vi.fn(), onStockIssue: vi.fn() })
    );
    expect(screen.getByText("0,00 €")).toBeInTheDocument();
    expect(screen.queryByText("29,90 €")).toBeNull();
  });
});
