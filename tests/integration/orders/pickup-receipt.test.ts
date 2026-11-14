// @vitest-environment node
// Le reçu envoyé au retrait, depuis les lignes réelles de la commande sur PostgreSQL : seul le
// transport d'e-mail est simulé. Le total imprimé est Order.totalCents (remise et rupture comprises).
import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.hoisted(() =>
  vi.fn(async (_to: string, _subject: string, _html: string) => true)
);
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { confirmPickup } from "@/lib/services/orders/commands/progress";
import { useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import { createOrder, createWorld } from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

describe("reçu de retrait", () => {
  it("n'inclut pas la ligne en rupture, imprime la remise et le total enregistré", async () => {
    const world = await createWorld();
    const lamb = await createTestProduct(world.shop.id, {
      name: "Côtes d'agneau",
      unit: "PIECE",
      priceCents: 1777,
    });
    const merguez = await createTestProduct(world.shop.id, {
      name: "Merguez",
      unit: "PIECE",
      priceCents: 620,
    });
    const order = await createOrder(world, {
      status: "READY",
      totalCents: 1489 + 620 - 275,
      overrides: { discountCents: 275 },
      items: [
        {
          productId: world.product.id,
          unit: "PIECE",
          quantity: 1,
          weightGrams: null,
          priceCents: 1489,
          totalCents: 1489,
        },
        { productId: lamb.id, quantity: 1, priceCents: 1777, totalCents: 1777, available: false },
        { productId: merguez.id, quantity: 1, priceCents: 620, totalCents: 620 },
      ],
    });

    const result = await confirmPickup({
      shopId: world.shop.id,
      actorId: world.owner.id,
      now: new Date(),
      target: { orderId: order.id, qrCode: null },
    });
    expect(result.kind).toBe("done");

    const receipt = sendEmail.mock.calls.find(([, subject]) => subject.includes("Reçu"));
    expect(receipt).toBeDefined();
    const html = receipt?.[2] as string;
    expect(html).toMatch(/TOTAL TTC<\/td>\s*<td[^>]*>18,34 €<\/td>/);
    expect(html).toContain("-2,75 €");
    expect(html).toContain("— non fourni");
    expect(html).not.toContain("17,77 €");
  });
});
