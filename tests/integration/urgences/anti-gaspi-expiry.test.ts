// @vitest-environment node
// Item 4 (C1-URGENCES) sur PostgreSQL réel : une remise anti-gaspi s'arrête à sa date de fin.
// Le boucher la pose en réécrivant Product.priceCents (prix d'origine gardé dans
// antiGaspiOrigPriceCents) et rien ne remet le prix d'origine à antiGaspiEndAt. Passée cette date,
// le devis et la commande facturent le prix d'origine, et le compteur anti-gaspi ne bloque plus la
// vente, n'est plus décrémenté ni réincrémenté. Avant cette date, rien ne change.
//
// Simulés : les transports sortants (e-mail, push, WhatsApp, confirmation de commande).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({
  isPushConfigured: () => true,
  sendPushNotification: vi.fn(async () => true),
}));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

import type { Prisma } from "@prisma/client";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import { cancelOrderByShop } from "@/lib/services/orders/commands/close";
import { createOrder } from "@/lib/services/orders/create";
import { releaseLimitedStock, reserveLimitedStock } from "@/lib/services/orders/limited-stock";
import { quoteOrder } from "@/lib/services/orders/quote";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { confirmedBody, customerOf, quoteRequest } from "../orders/create-order-fixtures";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;

function yesterday(): Date {
  return new Date(Date.now() - DAY_MS);
}

function tomorrow(): Date {
  return new Date(Date.now() + DAY_MS);
}

/**
 * A shop, a customer, and one piece sold 2000 put in anti-gaspi as POST /api/boucher/anti-gaspi
 * does: priceCents rewritten to 1000 (-50 %), original kept in antiGaspiOrigPriceCents.
 */
async function antiGaspiWorld(input: {
  endAt: Date | null;
  stock: number | null;
  shop?: Partial<Prisma.ShopUncheckedCreateInput>;
}) {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({ ownerId: owner.id, ...input.shop });
  const product = await createTestProduct(shop.id, {
    name: "Merguez anti-gaspi",
    unit: "PIECE",
    priceCents: 1000,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: 2000,
    antiGaspiEndAt: input.endAt,
    antiGaspiStock: input.stock,
    antiGaspiReason: "DLC proche",
  });
  const customer = customerOf(await createTestUser({ firstName: "Fatima" }));
  const oneUnit = quoteRequest(shop.id, [{ productId: product.id, quantity: 1 }]);
  return { owner, shop, product, customer, oneUnit };
}

function storedProduct(id: string) {
  return prisma.product.findUniqueOrThrow({ where: { id } });
}

async function placeOrder(world: Awaited<ReturnType<typeof antiGaspiWorld>>) {
  const created = await createOrder(
    await confirmedBody(world.oneUnit, world.customer),
    world.customer
  );
  if (!created.ok) throw new Error(`createOrder refused: ${created.code} ${created.message}`);
  return prisma.order.findUniqueOrThrow({
    where: { id: created.order.id },
    include: { items: true },
  });
}

describe("anti-gaspi past its end date", () => {
  it("is quoted and charged at the original price", async () => {
    const world = await antiGaspiWorld({ endAt: yesterday(), stock: null });

    const quoted = await quoteOrder(world.oneUnit, null, new Date());
    expect(quoted).toMatchObject({
      ok: true,
      quote: {
        lines: [{ productId: world.product.id, unitPriceCents: 2000, lineTotalCents: 2000 }],
        subtotalCents: 2000,
        totalCents: 2000,
        amountDueCents: 2000,
      },
    });

    const order = await placeOrder(world);
    expect(order.totalCents).toBe(2000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ priceCents: 2000, totalCents: 2000 });
  });

  it("is sold although its counter reached 0, and the counter is never decremented", async () => {
    const world = await antiGaspiWorld({ endAt: yesterday(), stock: 0 });

    const quoted = await quoteOrder(world.oneUnit, null, new Date());
    expect(quoted).toMatchObject({ ok: true, quote: { subtotalCents: 2000 } });

    const order = await placeOrder(world);
    expect(order.status).toBe("PENDING");
    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 15,
      now: new Date(),
    });
    expect(accepted.kind).toBe("done");

    // Read only: the row keeps its anti-gaspi columns until the butcher ends the mode.
    expect(await storedProduct(world.product.id)).toMatchObject({
      antiGaspiStock: 0,
      isAntiGaspi: true,
      priceCents: 1000,
    });
  });

  it("is sold in an auto-accept shop without touching the counter at creation", async () => {
    const world = await antiGaspiWorld({
      endAt: yesterday(),
      stock: 0,
      shop: { autoAccept: true },
    });

    const order = await placeOrder(world);

    expect(order.status).toBe("ACCEPTED");
    expect(order.totalCents).toBe(2000);
    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(0);
  });

  it("gives no unit back to an expired counter", async () => {
    const world = await antiGaspiWorld({ endAt: yesterday(), stock: 3 });

    await prisma.$transaction((tx) =>
      releaseLimitedStock(
        tx,
        world.shop.id,
        [{ productId: world.product.id, units: 2 }],
        new Date()
      )
    );

    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(3);
  });

  it("takes no unit from an expired counter", async () => {
    const world = await antiGaspiWorld({ endAt: yesterday(), stock: 1 });

    await prisma.$transaction((tx) =>
      reserveLimitedStock(
        tx,
        world.shop.id,
        [{ productId: world.product.id, units: 4 }],
        new Date()
      )
    );

    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(1);
  });

  it("does not give back, at cancellation, the unit an order took before the end date", async () => {
    const world = await antiGaspiWorld({ endAt: tomorrow(), stock: 2 });
    const order = await placeOrder(world);
    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 15,
      now: new Date(),
    });
    expect(accepted.kind).toBe("done");
    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(1);

    // The end date passes while the order is accepted.
    await prisma.product.update({
      where: { id: world.product.id },
      data: { antiGaspiEndAt: yesterday() },
    });
    const cancelled = await cancelOrderByShop({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
    });

    expect(cancelled.kind).toBe("done");
    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(1);
  });
});

describe("anti-gaspi before its end date", () => {
  it("is quoted and charged at the discounted price", async () => {
    const world = await antiGaspiWorld({ endAt: tomorrow(), stock: null });

    const quoted = await quoteOrder(world.oneUnit, null, new Date());
    expect(quoted).toMatchObject({
      ok: true,
      quote: { lines: [{ unitPriceCents: 1000 }], subtotalCents: 1000, totalCents: 1000 },
    });

    const order = await placeOrder(world);
    expect(order.totalCents).toBe(1000);
    expect(order.items[0]).toMatchObject({ priceCents: 1000, totalCents: 1000 });
  });

  it("is quoted at the discounted price when it has no end date", async () => {
    const world = await antiGaspiWorld({ endAt: null, stock: null });

    const quoted = await quoteOrder(world.oneUnit, null, new Date());

    expect(quoted).toMatchObject({ ok: true, quote: { subtotalCents: 1000 } });
  });

  it("keeps its counter: one acceptance takes the last unit, the next quote is refused", async () => {
    const world = await antiGaspiWorld({ endAt: tomorrow(), stock: 1 });
    const order = await placeOrder(world);

    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 15,
      now: new Date(),
    });

    expect(accepted.kind).toBe("done");
    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(0);
    expect(await quoteOrder(world.oneUnit, null, new Date())).toMatchObject({
      ok: false,
      code: "STOCK_INSUFFICIENT",
      details: { unavailableProductIds: [world.product.id] },
    });
  });

  it("gives units back to an in-force counter", async () => {
    const world = await antiGaspiWorld({ endAt: tomorrow(), stock: 3 });

    await prisma.$transaction((tx) =>
      releaseLimitedStock(
        tx,
        world.shop.id,
        [{ productId: world.product.id, units: 2 }],
        new Date()
      )
    );

    expect((await storedProduct(world.product.id)).antiGaspiStock).toBe(5);
  });
});
