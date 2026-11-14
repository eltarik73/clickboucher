// @vitest-environment node
// Ajustements de prix à paliers sur PostgreSQL réel : un ajustement en attente ne s'applique qu'à la
// commande pour laquelle il a été calculé (une rupture, une annulation ou un retrait le ferment),
// une seule validation gagne quand plusieurs lectures tombent sur l'échéance, et une pesée est
// valorisée par le module de tarification.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import {
  acceptAdjustment,
  rejectAdjustment,
  settleDueAdjustment,
} from "@/lib/services/orders/adjustment-answers";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import { cancelOrderByShop } from "@/lib/services/orders/commands/close";
import {
  reportUnavailableItems,
  resolveUnavailableItems,
} from "@/lib/services/orders/commands/unavailable";
import { getKitchenBoard } from "@/lib/services/orders/kitchen";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  MINUTE_MS,
  THREE_PORTIONS,
  createOrder,
  createWorld,
  notificationsOf,
  reload,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

/** Two lines: 2 x 1000 g of the world's product (2 x 1911) and one tray at 1576. */
async function twoLineOrder(world: World) {
  const tray = await createTestProduct(world.shop.id, {
    unit: "BARQUETTE",
    priceCents: 1576,
    name: "Merguez",
  });
  const order = await createOrder(world, {
    status: "ACCEPTED",
    items: [
      {
        productId: world.product.id,
        quantity: 2,
        weightGrams: 1000,
        priceCents: 1911,
        totalCents: 3822,
      },
      { productId: tray.id, quantity: 1, priceCents: 1576, totalCents: 1576 },
    ],
  });
  return { order, tray };
}

async function adjustment(orderId: string) {
  return prisma.priceAdjustment.findUniqueOrThrow({ where: { orderId } });
}

/** Moves the deadline of the pending tier-2 adjustment into the past. */
async function makeDue(orderId: string) {
  await prisma.priceAdjustment.update({
    where: { orderId },
    data: { autoApproveAt: new Date(Date.now() - MINUTE_MS) },
  });
}

describe("an adjustment pending when the order changes is never applied", () => {
  it("out of stock, removed line, deadline, acceptance: the total stays the recomputed one", async () => {
    const world = await createWorld();
    const { order, tray } = await twoLineOrder(world);
    // 5398 -> 6208 (+15 %) : palier 2, en attente.
    const created = await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });
    expect(created).toMatchObject({ ok: true, data: { tier: 2, autoApproved: false } });

    const reported = await reportUnavailableItems({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      productIds: [tray.id],
    });
    expect(reported.kind).toBe("done");
    expect(await adjustment(order.id)).toMatchObject({ status: "REJECTED" });

    const missing = (await reload(order.id)).items.find((item) => item.productId === tray.id);
    const resolved = await resolveUnavailableItems({
      orderId: order.id,
      userId: world.customer.id,
      decisions: [{ orderItemId: missing?.id as string, action: "remove" }],
      now: new Date(),
    });
    expect(resolved.kind).toBe("done");

    await makeDue(order.id);
    await getKitchenBoard(world.shop.id);
    await settleDueAdjustment(order.id, new Date());
    expect((await reload(order.id)).totalCents).toBe(3822);

    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 15,
      now: new Date(),
    });
    expect(accepted.kind).toBe("done");
    expect((await reload(order.id)).totalCents).toBe(3822);
    expect(
      await acceptAdjustment({ orderId: order.id, userId: world.customer.id, now: new Date() })
    ).toMatchObject({
      kind: "refused",
    });
    expect((await reload(order.id)).totalCents).toBe(3822);
  });

  it("a cancellation closes it: the due deadline then changes nothing", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });

    const cancelled = await cancelOrderByShop({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
    });
    expect(cancelled.kind).toBe("done");
    await makeDue(order.id);
    await settleDueAdjustment(order.id, new Date());

    const stored = await reload(order.id);
    expect(stored).toMatchObject({ status: "CANCELLED", totalCents: 5398 });
    expect(await adjustment(order.id)).toMatchObject({ status: "REJECTED" });
    expect(
      await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_AUTO_VALIDATED")
    ).toHaveLength(0);
  });

  it("a settlement racing a cancellation never leaves a settled adjustment beside a different total", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });
    await makeDue(order.id);

    await Promise.all([
      cancelOrderByShop({ orderId: order.id, shopId: world.shop.id, actorId: world.owner.id }),
      settleDueAdjustment(order.id, new Date()),
    ]);

    const stored = await reload(order.id);
    const settled = await adjustment(order.id);
    expect(stored.status).toBe("CANCELLED");
    expect(stored.totalCents).toBe(settled.status === "AUTO_VALIDATED" ? 6208 : 5398);
    expect(["AUTO_VALIDATED", "REJECTED"]).toContain(settled.status);
  });

  it("an order whose total changed by other means closes the adjustment instead of overwriting it", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });
    await prisma.order.update({ where: { id: order.id }, data: { totalCents: 5000 } });

    const answer = await acceptAdjustment({
      orderId: order.id,
      userId: world.customer.id,
      now: new Date(),
    });

    expect(answer).toMatchObject({ kind: "refused" });
    expect((await reload(order.id)).totalCents).toBe(5000);
    expect(await adjustment(order.id)).toMatchObject({ status: "REJECTED" });
  });
});

describe("settlement", () => {
  it("six concurrent reads of a due adjustment validate it once and notify once", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });
    await makeDue(order.id);

    await Promise.all(Array.from({ length: 6 }, () => settleDueAdjustment(order.id, new Date())));

    expect((await reload(order.id)).totalCents).toBe(6208);
    expect(await adjustment(order.id)).toMatchObject({ status: "AUTO_VALIDATED" });
    expect(
      await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_AUTO_VALIDATED")
    ).toHaveLength(1);
  });

  it("the customer's acceptance applies the line changes with the total, in their scope only", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });
    // 1,5 kg -> 1,75 kg : 1911 x 1,75 = 3344,25 -> 3344 (+16,6 %) : palier 2.
    const created = await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: order.items[0].id, newQuantity: 1.75 }],
    });
    expect(created).toMatchObject({ ok: true, data: { tier: 2 } });

    const stranger = await createWorld();
    expect(
      await acceptAdjustment({ orderId: order.id, userId: stranger.customer.id, now: new Date() })
    ).toEqual({
      kind: "not_found",
    });
    expect(
      (await acceptAdjustment({ orderId: order.id, userId: world.customer.id, now: new Date() }))
        .kind
    ).toBe("done");

    const stored = await reload(order.id);
    expect(stored.totalCents).toBe(3344);
    expect(stored.items[0]).toMatchObject({ quantity: 1.75, totalCents: 3344 });
    expect(await adjustment(order.id)).toMatchObject({ status: "APPROVED" });
  });

  it("a refusal leaves the order unchanged and cannot be settled afterwards", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "MANUAL",
      newTotalCents: 6208,
    });

    expect(
      (await rejectAdjustment({ orderId: order.id, userId: world.customer.id, now: new Date() }))
        .kind
    ).toBe("done");
    await makeDue(order.id);
    await settleDueAdjustment(order.id, new Date());

    expect((await reload(order.id)).totalCents).toBe(5398);
    expect(await adjustment(order.id)).toMatchObject({ status: "REJECTED" });
  });
});

describe("weighing through the pricing module", () => {
  it("weighing the same three 500 g portions again keeps their price (3 x 956, not round(1911 x 1,5))", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });

    const result = await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: order.items[0].id, newQuantity: 1.5 }],
    });

    expect(result).toMatchObject({ ok: true, data: { tier: 1, autoApproved: true } });
    const stored = await reload(order.id);
    expect(stored.items[0]).toMatchObject({ quantity: 1.5, totalCents: THREE_PORTIONS.totalCents });
    expect(stored.totalCents).toBe(THREE_PORTIONS.totalCents);
  });

  it("a lighter weighing is applied at once (tier 1) at the portion price of the weighed grams", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "PREPARING",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });

    await adjustOrderPrice(order.id, world.shop.id, {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: order.items[0].id, newQuantity: 1.47 }],
    });

    // 1470 g ne se découpe pas en portions de 500 g : une portion de 1470 g, floor((1911 x 1470 + 500) / 1000) = 2809.
    const stored = await reload(order.id);
    expect(stored.items[0]).toMatchObject({ quantity: 1.47, totalCents: 2809 });
    expect(stored.totalCents).toBe(2809);
    expect(await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_AUTO_APPROVED")).toHaveLength(
      1
    );
  });

  it("refuses a weight that is not whole grams and an adjustment of another shop's order", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });
    const other = await createWorld();

    expect(
      await adjustOrderPrice(order.id, world.shop.id, {
        adjustmentType: "WEIGHT",
        items: [{ orderItemId: order.items[0].id, newQuantity: 1.4705 }],
      })
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(
      await adjustOrderPrice(order.id, other.shop.id, {
        adjustmentType: "MANUAL",
        newTotalCents: 2000,
      })
    ).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await prisma.priceAdjustment.count()).toBe(0);
  });
});
