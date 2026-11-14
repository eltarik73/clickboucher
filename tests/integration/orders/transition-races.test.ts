// @vitest-environment node
// Requêtes concurrentes sur la même commande, sur PostgreSQL réel : la base départage, un seul
// gagnant écrit la transition, ses effets et sa notification ; les autres rejouent ou reçoivent 409.
import { beforeEach, describe, expect, it, vi } from "vitest";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
const serverAuth = vi.hoisted(() => ({ getServerUserId: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);
vi.mock("@/lib/auth/server-auth", () => serverAuth);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

import { PATCH as actionRoute } from "@/app/api/boucher/orders/[orderId]/action/route";
import { POST as cancelRoute } from "@/app/api/orders/[id]/cancel/route";
import { cancelOrderByShop, expireOrder } from "@/lib/services/orders/commands/close";
import { createOrder as placeOrder } from "@/lib/services/orders/create";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { confirmedBody, customerOf, quoteRequest } from "./create-order-fixtures";
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

const ROUNDS = 5;

beforeEach(() => {
  boucherAuth.getAuthenticatedBoucher.mockReset();
  serverAuth.getServerUserId.mockReset();
});

function signIn(world: World) {
  boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
    userId: world.owner.clerkId,
    shopId: world.shop.id,
  });
  serverAuth.getServerUserId.mockResolvedValue(world.customer.clerkId);
}

async function accept(orderId: string) {
  const body = { action: "accept", estimatedMinutes: 15 };
  return readResponse(
    await actionRoute(jsonRequest(`/api/boucher/orders/${orderId}/action`, "PATCH", body), {
      params: { orderId },
    })
  );
}

async function customerCancel(orderId: string) {
  return readResponse(
    await cancelRoute(jsonRequest(`/api/orders/${orderId}/cancel`, "POST"), {
      params: { id: orderId },
    })
  );
}

async function limitedOrder(world: World, overrides: Record<string, unknown> = {}) {
  const product = await createTestProduct(world.shop.id, {
    isAntiGaspi: true,
    antiGaspiStock: 5,
    antiGaspiOrigPriceCents: 2500,
  });
  const order = await createOrder(world, {
    items: [{ productId: product.id, ...THREE_PORTIONS }],
    overrides,
  });
  const stockOf = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).antiGaspiStock;
  return { order, stockOf };
}

describe("parallel accepts", () => {
  it("three accepts: one transition, one event, one QR code, one notification, one reservation", async () => {
    const world = await createWorld();
    signIn(world);
    const { order, stockOf } = await limitedOrder(world);

    const results = await Promise.all([accept(order.id), accept(order.id), accept(order.id)]);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect(results.filter((result) => result.body.data?._idempotent === true)).toHaveLength(2);

    const stored = await reload(order.id);
    expect(stored.status).toBe("ACCEPTED");
    expect(new Set(results.map((result) => result.body.data?.qrCode))).toEqual(
      new Set([stored.qrCode])
    );
    expect(await eventsOf(order.id, "ACCEPTED")).toHaveLength(1);
    expect(await notificationsOf(world.customer.id, "ORDER_ACCEPTED")).toHaveLength(1);
    expect(await stockOf()).toBe(2);
  });
});

describe("accept against customer cancel", () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: one winner, one 409, consistent effects",
    async () => {
      const world = await createWorld();
      signIn(world);
      const offer = await createTestOffer({ currentUses: 1, maxUses: 5 });
      // Placed 10 minutes ago: once accepted, the customer can no longer cancel.
      const { order, stockOf } = await limitedOrder(world, {
        offerId: offer.id,
        createdAt: new Date(Date.now() - 10 * MINUTE_MS),
      });

      const [accepted, cancelled] = await Promise.all([accept(order.id), customerCancel(order.id)]);
      expect([accepted.status, cancelled.status].sort()).toEqual([200, 409]);

      const stored = await reload(order.id);
      const offerUses = (await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } }))
        .currentUses;
      if (accepted.status === 200) {
        expect(stored.status).toBe("ACCEPTED");
        expect(await stockOf()).toBe(2);
        expect(offerUses).toBe(1);
      } else {
        expect(stored.status).toBe("CANCELLED");
        expect(await stockOf()).toBe(5);
        expect(offerUses).toBe(0);
      }
    }
  );
});

describe("expire against accept", () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: exactly one winner",
    async () => {
      const world = await createWorld();
      signIn(world);
      const { order, stockOf } = await limitedOrder(world, {
        expiresAt: new Date(Date.now() - MINUTE_MS),
      });

      const [accepted, expired] = await Promise.all([
        accept(order.id),
        expireOrder({ orderId: order.id, now: new Date() }),
      ]);
      const acceptWon = accepted.status === 200;
      expect(acceptWon).toBe(expired.kind !== "done");
      if (!acceptWon) expect(accepted.status).toBe(409);

      const stored = await reload(order.id);
      expect(stored.status).toBe(acceptWon ? "ACCEPTED" : "AUTO_CANCELLED");
      expect(await stockOf()).toBe(acceptWon ? 2 : 5);
      expect(
        await notificationsOf(world.customer.id, acceptWon ? "ORDER_ACCEPTED" : "ORDER_EXPIRED")
      ).toHaveLength(1);
    }
  );
});

describe("auto-accepted creation against the cancellation of an order holding the same offer and product", () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round))(
    "round %i: both succeed",
    async (round) => {
      const shop = await createTestShop({ autoAccept: true });
      const product = await createTestProduct(shop.id, {
        unit: "PIECE",
        priceCents: 300,
        isFlashSale: true,
        flashSaleStock: 50,
      });
      const offer = await createTestOffer({ code: `RACE${round}`, discountValue: 10 });
      const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }], offer.code);
      const alice = customerOf(await createTestUser());
      const bob = customerOf(await createTestUser());
      const held = await placeOrder(await confirmedBody(request, alice), alice);
      expect(held).toMatchObject({ ok: true, order: { status: "ACCEPTED" } });
      if (!held.ok) return;
      const bobBody = await confirmedBody(request, bob);

      const [created, cancelled] = await Promise.all([
        placeOrder(bobBody, bob),
        cancelOrderByShop({ orderId: held.order.id, shopId: shop.id, actorId: "butcher" }),
      ]);

      expect(created).toMatchObject({ ok: true, status: 201 });
      expect(cancelled.kind).toBe("done");
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).flashSaleStock
      ).toBe(48);
      expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(
        1
      );
    }
  );
});
