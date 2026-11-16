// @vitest-environment node
// Ajustements de prix sur PostgreSQL réel : un ajustement en attente ne s'applique qu'à la commande
// pour laquelle il a été calculé (une rupture, une annulation ou un retrait le ferment, motif
// ORDER_CHANGED, avec son événement), une seule réponse gagne quand plusieurs requêtes se croisent,
// une pesée est valorisée par le module de tarification et une proposition qui ne change rien
// n'écrit rien. La marge de pesée : *-tolerance.test.ts ; les réponses du client et le silence :
// *-answers.test.ts.
import { describe, expect, it, vi } from "vitest";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { PATCH } from "@/app/api/orders/[id]/adjust-price/route";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { acceptAdjustment, rejectAdjustment } from "@/lib/services/orders/adjustment-answers";
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
  THREE_PORTIONS,
  adjustmentOf,
  butcherOf,
  createOrder,
  createWorld,
  customerAnswer,
  eventsOf,
  jsonRequest,
  notificationsOf,
  readResponse,
  reload,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const ROUNDS = 5;

/** Two lines: 2 x 1000 g of the world's product (2 x 1911) and one tray at 1576. */
async function twoLineOrder(world: World) {
  const tray = await createTestProduct(world.shop.id, { unit: "BARQUETTE", priceCents: 1576 });
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

/** 5398 -> 6208 typed by the butcher: an increase, so it waits for the customer's answer. */
async function pendingManualIncrease(world: World, orderId: string) {
  const created = await adjustOrderPrice(orderId, butcherOf(world), {
    adjustmentType: "MANUAL",
    newTotalCents: 6208,
  });
  expect(created).toMatchObject({ ok: true, data: { applied: false } });
}

const answer = (world: World, orderId: string) =>
  customerAnswer(orderId, world.customer.id, new Date());

describe("an adjustment pending when the order changes is never applied", () => {
  it("out of stock, removed line, acceptance: the total stays the recomputed one", async () => {
    const world = await createWorld();
    const { order, tray } = await twoLineOrder(world);
    await pendingManualIncrease(world, order.id);

    const reported = await reportUnavailableItems({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      productIds: [tray.id],
    });
    expect(reported.kind).toBe("done");
    expect(await adjustmentOf(order.id)).toMatchObject({ closeReason: "ORDER_CHANGED" });
    const closed = await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED");
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ actorId: "system" });
    expect(closed[0].payloadJson).toMatchObject({ reason: "ORDER_CHANGED", from: 5398, to: 6208 });

    const missing = (await reload(order.id)).items.find((item) => item.productId === tray.id);
    const resolved = await resolveUnavailableItems({
      orderId: order.id,
      userId: world.customer.id,
      decisions: [{ orderItemId: missing?.id as string, action: "remove" }],
      now: new Date(),
    });
    expect(resolved.kind).toBe("done");

    await getKitchenBoard(world.shop.id);
    expect((await reload(order.id)).totalCents).toBe(3822);

    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 15,
      now: new Date(),
    });
    expect(accepted.kind).toBe("done");
    expect(await acceptAdjustment(answer(world, order.id))).toMatchObject({ kind: "refused" });
    expect((await reload(order.id)).totalCents).toBe(3822);
  });

  it("a cancellation closes it: an acceptance afterwards changes nothing", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await pendingManualIncrease(world, order.id);

    const cancelled = await cancelOrderByShop({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
    });
    expect(cancelled.kind).toBe("done");
    expect(await acceptAdjustment(answer(world, order.id))).toMatchObject({ kind: "refused" });

    expect(await reload(order.id)).toMatchObject({ status: "CANCELLED", totalCents: 5398 });
    expect(await adjustmentOf(order.id)).toMatchObject({ closeReason: "ORDER_CHANGED" });
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_ACCEPTED")).toHaveLength(0);
  });

  it("an acceptance racing a cancellation never leaves an applied adjustment beside a different total", async () => {
    const world = await createWorld();
    const { order } = await twoLineOrder(world);
    await pendingManualIncrease(world, order.id);

    await Promise.all([
      cancelOrderByShop({ orderId: order.id, shopId: world.shop.id, actorId: world.owner.id }),
      acceptAdjustment(answer(world, order.id)),
    ]);

    const stored = await reload(order.id);
    const settled = await adjustmentOf(order.id);
    expect(stored.status).toBe("CANCELLED");
    expect(stored.totalCents).toBe(settled.status === "APPROVED" ? 6208 : 5398);
    expect(["APPROVED", "REJECTED"]).toContain(settled.status);
  });
});

describe("the customer's answer", () => {
  it("an acceptance applies the line changes with the total, in their scope only", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });
    // 1,5 kg -> 1,75 kg : 1911 x 1,75 = 3344,25 -> 3344. Commande sans marge figée : on demande.
    const created = await adjustOrderPrice(order.id, butcherOf(world), {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: order.items[0].id, newQuantity: 1.75 }],
    });
    expect(created).toMatchObject({ ok: true, data: { applied: false } });

    const stranger = await createWorld();
    expect(
      await acceptAdjustment({ orderId: order.id, userId: stranger.customer.id, now: new Date() })
    ).toEqual({ kind: "not_found" });
    expect((await acceptAdjustment(answer(world, order.id))).kind).toBe("done");

    const stored = await reload(order.id);
    expect(stored.totalCents).toBe(3344);
    expect(stored.items[0]).toMatchObject({ quantity: 1.75, totalCents: 3344 });
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "APPROVED" });
  });

  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: an acceptance and a refusal racing each other, exactly one wins",
    async () => {
      const world = await createWorld();
      const { order } = await twoLineOrder(world);
      await pendingManualIncrease(world, order.id);

      const [accepted, refused] = await Promise.all([
        acceptAdjustment(answer(world, order.id)),
        rejectAdjustment(answer(world, order.id)),
      ]);

      expect([accepted.kind, refused.kind].sort()).toEqual(["done", "refused"]);
      const settled = await adjustmentOf(order.id);
      expect((await reload(order.id)).totalCents).toBe(settled.status === "APPROVED" ? 6208 : 5398);
      const events = [
        ...(await eventsOf(order.id, "PRICE_ADJUSTED")),
        ...(await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED")),
      ];
      expect(events).toHaveLength(1);
    }
  );
});

describe("weighing through the pricing module", () => {
  it("the same three 500 g portions weighed again, or the current total typed, change and write nothing (3 x 956, not round(1911 x 1,5))", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });

    for (const request of [
      { adjustmentType: "WEIGHT", items: [{ orderItemId: order.items[0].id, newQuantity: 1.5 }] },
      { adjustmentType: "MANUAL", newTotalCents: THREE_PORTIONS.totalCents },
    ] satisfies AdjustPriceRequest[]) {
      // Nothing applied: no adjustment ever set this order's total.
      expect(await adjustOrderPrice(order.id, butcherOf(world), request)).toEqual({
        ok: true,
        data: { adjustment: null, applied: false, _idempotent: true },
      });
    }
    const stored = await reload(order.id);
    expect(stored.items[0]).toMatchObject({ quantity: 1.5, totalCents: THREE_PORTIONS.totalCents });
    expect(stored.totalCents).toBe(THREE_PORTIONS.totalCents);
    expect(await prisma.priceAdjustment.count()).toBe(0);
    expect(await eventsOf(order.id)).toHaveLength(0);
    expect(await notificationsOf(world.customer.id)).toHaveLength(0);
  });

  it("a lighter weighing is applied at once at the portion price of the weighed grams, once when sent twice", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "PREPARING",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });
    const request: AdjustPriceRequest = {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: order.items[0].id, newQuantity: 1.47 }],
    };

    const first = await adjustOrderPrice(order.id, butcherOf(world), request);
    const second = await adjustOrderPrice(order.id, butcherOf(world), request);

    // 1470 g ne se découpe pas en portions de 500 g : une portion de 1470 g, floor((1911 x 1470 + 500) / 1000) = 2809.
    const stored = await reload(order.id);
    expect(stored.items[0]).toMatchObject({ quantity: 1.47, totalCents: 2809 });
    expect(stored.totalCents).toBe(2809);
    const row = await adjustmentOf(order.id);
    expect(first).toMatchObject({ ok: true, data: { applied: true, adjustment: { id: row.id } } });
    expect(second).toEqual({
      ok: true,
      data: { adjustment: row, applied: true, _idempotent: true },
    });
    expect(await eventsOf(order.id, "PRICE_ADJUSTED")).toHaveLength(1);
    expect(await notificationsOf(world.customer.id)).toHaveLength(1);
  });

  it("refuses a weight that is not whole grams, an unreadable body and another shop's order", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: world.product.id, ...THREE_PORTIONS }],
    });
    const other = await createWorld();

    expect(
      await adjustOrderPrice(order.id, butcherOf(world), {
        adjustmentType: "WEIGHT",
        items: [{ orderItemId: order.items[0].id, newQuantity: 1.4705 }],
      })
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      shopId: world.shop.id,
      userId: world.owner.id,
    });
    const url = `/api/orders/${order.id}/adjust-price`;
    const tip = jsonRequest(url, "PATCH", { adjustmentType: "TIP" });
    expect(await readResponse(await PATCH(tip, { params: { id: order.id } }))).toMatchObject({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR", message: "Données invalides" } },
    });
    expect(
      await adjustOrderPrice(order.id, butcherOf(other), {
        adjustmentType: "MANUAL",
        newTotalCents: 2000,
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await prisma.priceAdjustment.count()).toBe(0);
  });
});
