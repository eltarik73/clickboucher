// @vitest-environment node
// Commandes du client sur PostgreSQL réel : annulation (fenêtre, portée, remise rendue), réponse à
// une rupture (retour en attente, remplacement de même unité, prix du module de tarification) et
// notation (une seule fois).
import { beforeEach, describe, expect, it, vi } from "vitest";

const serverAuth = vi.hoisted(() => ({ getServerUserId: vi.fn() }));
vi.mock("@/lib/auth/server-auth", () => serverAuth);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { POST as cancelRoute } from "@/app/api/orders/[id]/cancel/route";
import { POST as chooseRoute } from "@/app/api/orders/[id]/choose-alternatives/route";
import { POST as rateRoute } from "@/app/api/orders/[id]/rate/route";
import { lineQuantityFromStored, lineTotalCents } from "@/lib/pricing/line";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import { reportUnavailableItems } from "@/lib/services/orders/commands/unavailable";
import { consumeLoyaltyReward, consumeOffer } from "@/lib/services/orders/discount-ledger";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestProduct, createTestUser } from "../helpers/factories";
import {
  MINUTE_MS,
  THREE_PORTIONS,
  createOrder,
  createWorld,
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

beforeEach(() => {
  serverAuth.getServerUserId.mockReset();
});

function signInAs(clerkId: string | null) {
  serverAuth.getServerUserId.mockResolvedValue(clerkId);
}

async function cancel(orderId: string) {
  return readResponse(
    await cancelRoute(jsonRequest(`/api/orders/${orderId}/cancel`, "POST"), {
      params: { id: orderId },
    })
  );
}

async function choose(orderId: string, decisions: unknown[]) {
  return readResponse(
    await chooseRoute(
      jsonRequest(`/api/orders/${orderId}/choose-alternatives`, "POST", { decisions }),
      { params: { id: orderId } }
    )
  );
}

async function rate(orderId: string, rating: number) {
  return readResponse(
    await rateRoute(
      jsonRequest(`/api/orders/${orderId}/rate`, "POST", { rating, comment: "Parfait" }),
      { params: { id: orderId } }
    )
  );
}

describe("customer cancellation", () => {
  it("cancels a PENDING order, tells the shop owner once, and replays", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const order = await createOrder(world);

    const first = await cancel(order.id);
    expect(first.status).toBe(200);
    expect((await reload(order.id)).status).toBe("CANCELLED");
    const replay = await cancel(order.id);
    expect(replay.body.data?._idempotent).toBe(true);

    const rows = await notificationsOf(world.owner.id, "ORDER_CANCELLED_BY_CUSTOMER");
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBe(order.id);
    expect(await eventsOf(order.id, "CANCELLED")).toHaveLength(1);
  });

  it("refuses an ACCEPTED order placed more than 5 minutes ago", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const order = await createOrder(world, {
      status: "ACCEPTED",
      overrides: { createdAt: new Date(Date.now() - 6 * MINUTE_MS) },
    });

    const result = await cancel(order.id);
    expect(result.status).toBe(409);
    expect(result.body.error?.details).toEqual({ currentStatus: ["ACCEPTED"] });
    expect((await reload(order.id)).status).toBe("ACCEPTED");
    expect(await eventsOf(order.id)).toHaveLength(0);
  });

  it("cancels an ACCEPTED order placed less than 5 minutes ago", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const order = await createOrder(world, { status: "ACCEPTED" });
    expect((await cancel(order.id)).status).toBe(200);
    expect((await reload(order.id)).status).toBe("CANCELLED");
  });

  it("does not find another customer's order", async () => {
    const world = await createWorld();
    const stranger = await createTestUser();
    signInAs(stranger.clerkId);
    const order = await createOrder(world);

    expect((await cancel(order.id)).status).toBe(404);
    expect((await reload(order.id)).status).toBe("PENDING");
  });

  it("gives back the offer use and the loyalty reward: both can be used again", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const offer = await createTestOffer({ maxUses: 1, currentUses: 1 });
    const order = await createOrder(world, { overrides: { offerId: offer.id } });
    const reward = await prisma.loyaltyReward.create({
      data: {
        userId: world.customer.id,
        tier: 3,
        rewardType: "FIXED",
        rewardCents: 200,
        code: "KG-ITEST1",
        usedAt: new Date(),
        usedOnOrderId: order.id,
        expiresAt: new Date(Date.now() + 24 * 60 * MINUTE_MS),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { loyaltyRewardId: reward.id } });

    expect((await cancel(order.id)).status).toBe(200);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
    expect(
      await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })
    ).toMatchObject({
      usedAt: null,
      usedOnOrderId: null,
    });

    const next = await createOrder(world);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await consumeOffer(tx, { offerId: offer.id, userId: world.customer.id, now });
      await consumeLoyaltyReward(tx, {
        rewardId: reward.id,
        userId: world.customer.id,
        orderId: next.id,
        now,
      });
    });
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(1);
  });
});

describe("answer to an out-of-stock question", () => {
  async function partiallyDenied(world: World) {
    const missing = await createTestProduct(world.shop.id, { name: "Merguez" });
    const order = await createOrder(world, {
      status: "PARTIALLY_DENIED",
      items: [
        { productId: world.product.id },
        { productId: missing.id, ...THREE_PORTIONS, available: false },
      ],
      totalCents: 1911 - 100,
      overrides: {
        discountCents: 100,
        qrCode: "4a1b2c3d-1111-4222-8333-944455556666",
        estimatedReady: new Date(),
        denyReason: "Certains articles sont en rupture de stock",
      },
    });
    return { order, missingLine: order.items[1] };
  }

  it("returns the order to PENDING with a replacement priced by the pricing module", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const { order, missingLine } = await partiallyDenied(world);
    const replacement = await createTestProduct(world.shop.id, { priceCents: 2399, promoPct: 10 });

    const before = Date.now();
    const result = await choose(order.id, [
      { orderItemId: missingLine.id, action: "replace", replacementProductId: replacement.id },
    ]);
    expect(result.status).toBe(200);

    const price = resolveUnitPrice(replacement, { isPro: false, now: new Date() });
    if (!price.ok) throw new Error("replacement price refused");
    const expectedLine = lineTotalCents(lineQuantityFromStored(missingLine), price.unitPriceCents);
    const stored = await reload(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.qrCode).toBeNull();
    expect(stored.estimatedReady).toBeNull();
    expect(stored.expiresAt?.getTime()).toBeGreaterThan(before);
    const line = stored.items.find((item) => item.id === missingLine.id);
    expect(line).toMatchObject({
      productId: replacement.id,
      available: true,
      totalCents: expectedLine,
    });
    expect(stored.totalCents).toBe(1911 + expectedLine - 100);
  });

  it("lets the customer remove a replacement the butcher then reports missing", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const { order, missingLine } = await partiallyDenied(world);
    const replacement = await createTestProduct(world.shop.id, {
      name: "Saucisse",
      priceCents: 1500,
    });
    expect(
      (
        await choose(order.id, [
          { orderItemId: missingLine.id, action: "replace", replacementProductId: replacement.id },
        ])
      ).status
    ).toBe(200);
    const accepted = await acceptOrder({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      estimatedMinutes: 20,
      now: new Date(),
    });
    expect(accepted.kind).toBe("done");

    const reported = await reportUnavailableItems({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      productIds: [replacement.id],
    });
    expect(reported.kind).toBe("done");
    const partial = await reload(order.id);
    expect(partial.status).toBe("PARTIALLY_DENIED");
    expect(partial.items.find((item) => item.id === missingLine.id)).toMatchObject({
      available: false,
      replacement: null,
    });

    const result = await choose(order.id, [{ orderItemId: missingLine.id, action: "remove" }]);
    expect(result.status).toBe(200);
    const stored = await reload(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.totalCents).toBe(1911 - 100);
    expect(stored.items.find((item) => item.id === missingLine.id)?.replacement).toBe("removed");
  });

  it("refuses a replacement sold in another unit", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const { order, missingLine } = await partiallyDenied(world);
    const piece = await createTestProduct(world.shop.id, { unit: "PIECE", priceCents: 300 });

    const result = await choose(order.id, [
      { orderItemId: missingLine.id, action: "replace", replacementProductId: piece.id },
    ]);
    expect(result.status).toBe(400);
    const stored = await reload(order.id);
    expect(stored.status).toBe("PARTIALLY_DENIED");
    expect(stored.items.find((item) => item.id === missingLine.id)?.productId).toBe(
      missingLine.productId
    );
  });
});

describe("rating", () => {
  it("completes a PICKED_UP order once; a second rating is refused", async () => {
    const world = await createWorld();
    signInAs(world.customer.clerkId);
    const order = await createOrder(world, { status: "PICKED_UP" });

    expect((await rate(order.id, 4)).status).toBe(200);
    const stored = await reload(order.id);
    expect(stored).toMatchObject({ status: "COMPLETED", rating: 4 });
    expect(await prisma.shop.findUniqueOrThrow({ where: { id: world.shop.id } })).toMatchObject({
      rating: 4,
      ratingCount: 1,
    });

    const second = await rate(order.id, 1);
    expect(second.status).toBe(409);
    expect((await reload(order.id)).rating).toBe(4);
    expect(
      (await prisma.shop.findUniqueOrThrow({ where: { id: world.shop.id } })).ratingCount
    ).toBe(1);
  });
});
