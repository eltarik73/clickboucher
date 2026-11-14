// @vitest-environment node
// Tableau du mode cuisine : toutes les commandes actives de la boutique, l'historique récent borné et
// lu à part, seules les colonnes affichées, aucune fuite entre boutiques, et le règlement des
// ajustements de prix échus comme aujourd'hui.
import type { OrderStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);

// Transports sortants : l'auto-validation d'un ajustement notifie le client.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppRaw: vi.fn().mockResolvedValue(undefined),
}));

import {
  countPendingOrders,
  getKitchenBoard,
  getKitchenHistory,
} from "@/lib/services/orders/kitchen";
import { GET as getKitchenRoute } from "@/app/api/boucher/orders/kitchen/route";
import { GET as getPendingCountRoute } from "@/app/api/boucher/orders/pending-count/route";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * MINUTE_MS);
}

async function orderAt(
  shopId: string,
  userId: string,
  status: OrderStatus,
  createdAt: Date,
  updatedAt: Date = createdAt
) {
  return createTestOrder({ shopId, userId, status, overrides: { createdAt, updatedAt } });
}

function unauthenticated(status: 401 | 403) {
  return {
    error: Response.json(
      {
        success: false,
        error: { code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", message: "refusé" },
      },
      { status }
    ),
  };
}

beforeEach(() => {
  boucherAuth.getAuthenticatedBoucher.mockReset();
});

describe("getKitchenBoard", () => {
  it("lists every active order even behind 60 newer finished ones; history keeps the 50 most recently updated", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const pending = await orderAt(shop.id, client.id, "PENDING", minutesAgo(600));
    const ready = await orderAt(shop.id, client.id, "READY", minutesAgo(590));
    const partial = await orderAt(shop.id, client.id, "PARTIALLY_DENIED", minutesAgo(580));
    const cancelled = [];
    for (let i = 0; i < 60; i += 1) {
      cancelled.push(
        await orderAt(shop.id, client.id, "CANCELLED", minutesAgo(500 - i), minutesAgo(400 - i))
      );
    }

    const board = await getKitchenBoard(shop.id);
    const history = await getKitchenHistory(shop.id);

    expect(board.active.map((o) => o.id).sort()).toEqual([pending.id, ready.id, partial.id].sort());
    expect(board.active.map((o) => o.id)).toEqual([partial.id, ready.id, pending.id]);
    expect(board.activeTruncated).toBe(false);
    expect(history).toHaveLength(50);
    const expectedHistory = cancelled
      .slice()
      .reverse()
      .slice(0, 50)
      .map((o) => o.id);
    expect(history.map((o) => o.id)).toEqual(expectedHistory);
  });

  it("history excludes finished orders last updated more than 7 days ago and never lists active ones", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const recent = await orderAt(shop.id, client.id, "PICKED_UP", minutesAgo(60));
    await orderAt(shop.id, client.id, "COMPLETED", new Date(Date.now() - 8 * DAY_MS));
    const old = await orderAt(shop.id, client.id, "ACCEPTED", new Date(Date.now() - 9 * DAY_MS));

    const board = await getKitchenBoard(shop.id);

    expect((await getKitchenHistory(shop.id)).map((o) => o.id)).toEqual([recent.id]);
    expect(board.active.map((o) => o.id)).toEqual([old.id]);
  });

  it("returns the order's own customer number snapshot and no user-level customer number", async () => {
    const shop = await createTestShop();
    const client = await createTestUser({ customerNumber: "C-777" });
    await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      overrides: { customerNumber: 12 },
    });

    const board = await getKitchenBoard(shop.id);

    expect(board.active[0].customerNumber).toBe(12);
    expect(board.active[0].user).not.toHaveProperty("customerNumber");
  });

  it("never returns orders of another shop, in active, history or the pending count", async () => {
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    const client = await createTestUser();
    const own = await orderAt(shop.id, client.id, "PENDING", minutesAgo(10));
    const ownDone = await orderAt(shop.id, client.id, "COMPLETED", minutesAgo(20));
    for (const status of [
      "PENDING",
      "PENDING",
      "ACCEPTED",
      "READY",
      "CANCELLED",
      "PICKED_UP",
    ] as const) {
      await orderAt(otherShop.id, client.id, status, minutesAgo(5));
    }

    const board = await getKitchenBoard(shop.id);

    expect(board.active.map((o) => o.id)).toEqual([own.id]);
    expect((await getKitchenHistory(shop.id)).map((o) => o.id)).toEqual([ownDone.id]);
    expect(await countPendingOrders(shop.id)).toBe(1);
    expect(await countPendingOrders(otherShop.id)).toBe(2);
  });

  it("reports activeTruncated and returns only the limit when more active orders exist", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    await orderAt(shop.id, client.id, "PENDING", minutesAgo(30));
    const second = await orderAt(shop.id, client.id, "ACCEPTED", minutesAgo(20));
    const newest = await orderAt(shop.id, client.id, "PREPARING", minutesAgo(10));

    const board = await getKitchenBoard(shop.id, { activeLimit: 2 });

    expect(board.activeTruncated).toBe(true);
    expect(board.active.map((o) => o.id)).toEqual([newest.id, second.id]);

    const exact = await getKitchenBoard(shop.id, { activeLimit: 3 });
    expect(exact.activeTruncated).toBe(false);
    expect(exact.active).toHaveLength(3);
  });

  it("settles a due tier-2 price adjustment of an active order before returning it, as GET /api/orders does", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const order = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      status: "ACCEPTED",
      totalCents: 2000,
    });
    await prisma.priceAdjustment.create({
      data: {
        orderId: order.id,
        shopId: shop.id,
        originalTotal: 2000,
        newTotal: 2150,
        adjustmentType: "WEIGHT",
        tier: 2,
        autoApproveAt: minutesAgo(1),
      },
    });
    const notDue = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      status: "ACCEPTED",
      totalCents: 1000,
    });
    await prisma.priceAdjustment.create({
      data: {
        orderId: notDue.id,
        shopId: shop.id,
        originalTotal: 1000,
        newTotal: 1100,
        adjustmentType: "WEIGHT",
        tier: 2,
        autoApproveAt: new Date(Date.now() + 5 * MINUTE_MS),
      },
    });

    const board = await getKitchenBoard(shop.id);

    const settled = board.active.find((o) => o.id === order.id);
    expect(settled?.priceAdjustment?.status).toBe("AUTO_VALIDATED");
    expect(settled?.totalCents).toBe(2150);
    const waiting = board.active.find((o) => o.id === notDue.id);
    expect(waiting?.priceAdjustment?.status).toBe("PENDING");
    expect(waiting?.totalCents).toBe(1000);
  });

  it("does not settle adjustments of finished orders", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const order = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      status: "PICKED_UP",
      totalCents: 2000,
    });
    await prisma.priceAdjustment.create({
      data: {
        orderId: order.id,
        shopId: shop.id,
        originalTotal: 2000,
        newTotal: 2150,
        adjustmentType: "WEIGHT",
        tier: 2,
        autoApproveAt: minutesAgo(1),
      },
    });

    await getKitchenBoard(shop.id);
    await getKitchenHistory(shop.id);

    const stored = await prisma.priceAdjustment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(stored.status).toBe("PENDING");
  });
});

describe("kitchen columns", () => {
  const ORDER_COLUMNS = [
    "actualReady",
    "createdAt",
    "customerNote",
    "customerNumber",
    "discountCents",
    "displayNumber",
    "estimatedReady",
    "id",
    "isPro",
    "items",
    "orderNumber",
    "paymentMethod",
    "pickupSlotStart",
    "priceAdjustment",
    "qrCode",
    "requestedTime",
    "status",
    "totalCents",
    "updatedAt",
    "user",
  ].sort();
  const ITEM_COLUMNS = [
    "available",
    "cutOption",
    "id",
    "name",
    "pieceCount",
    "pieceLabel",
    "priceCents",
    "product",
    "productId",
    "quantity",
    "sliceCount",
    "sliceThickness",
    "totalCents",
    "unit",
    "variant",
    "weightGrams",
  ].sort();

  it("an active order carries only the columns the board renders", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const product = await createTestProduct(shop.id);
    const order = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      status: "ACCEPTED",
      totalCents: 2000,
      items: [{ productId: product.id }],
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        idempotencyKey: "kitchen-columns-key",
        commissionCents: 120,
        stripePaymentIntentId: "pi_test",
      },
    });
    await prisma.priceAdjustment.create({
      data: {
        orderId: order.id,
        shopId: shop.id,
        originalTotal: 2000,
        newTotal: 1900,
        adjustmentType: "WEIGHT",
      },
    });

    const [row] = (await getKitchenBoard(shop.id)).active;

    expect(Object.keys(row).sort()).toEqual(ORDER_COLUMNS);
    expect(row.items).toHaveLength(1);
    for (const item of row.items) {
      expect(Object.keys(item).sort()).toEqual(ITEM_COLUMNS);
      expect(Object.keys(item.product).sort()).toEqual(["imageUrl", "name", "unit"]);
    }
    expect(Object.keys(row.user).sort()).toEqual([
      "firstName",
      "lastName",
      "loyaltyBadge",
      "phone",
    ]);
    expect(Object.keys(row.priceAdjustment ?? {}).sort()).toEqual(
      ["adjustmentType", "id", "newTotal", "originalTotal", "reason", "status"].sort()
    );
    const wire = JSON.stringify(row);
    for (const secret of [
      "kitchen-columns-key",
      "pi_test",
      "commissionCents",
      "shopId",
      "userId",
    ]) {
      expect(wire).not.toContain(secret);
    }
  });

  it("a history order carries only what the history list prints", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    await createTestOrder({ shopId: shop.id, userId: client.id, status: "PICKED_UP" });

    const [row] = await getKitchenHistory(shop.id);

    expect(Object.keys(row).sort()).toEqual(
      [
        "displayNumber",
        "id",
        "items",
        "orderNumber",
        "status",
        "totalCents",
        "updatedAt",
        "user",
      ].sort()
    );
    for (const item of row.items) expect(Object.keys(item)).toEqual(["quantity"]);
    expect(Object.keys(row.user).sort()).toEqual(["firstName", "lastName"]);
  });
});

const kitchenRequest = (query = "") =>
  new Request(`http://localhost/api/boucher/orders/kitchen${query}`);

describe("GET /api/boucher/orders/kitchen and /pending-count", () => {
  it.each([401, 403] as const)(
    "answer %s without a butcher session and read nothing",
    async (status) => {
      const shop = await createTestShop();
      const client = await createTestUser();
      await orderAt(shop.id, client.id, "PENDING", minutesAgo(5));
      boucherAuth.getAuthenticatedBoucher.mockResolvedValue(unauthenticated(status));

      const kitchen = await getKitchenRoute(kitchenRequest("?history=1"));
      const count = await getPendingCountRoute();

      expect(kitchen.status).toBe(status);
      expect(count.status).toBe(status);
      expect(JSON.stringify(await kitchen.json())).not.toContain(shop.id);
    }
  );

  it("return the active board without history, and the pending count, never cached", async () => {
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    const client = await createTestUser();
    const pending = await orderAt(shop.id, client.id, "PENDING", minutesAgo(5));
    await orderAt(shop.id, client.id, "PICKED_UP", minutesAgo(15));
    await orderAt(otherShop.id, client.id, "PENDING", minutesAgo(1));
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      userId: shop.ownerId,
      shopId: shop.id,
    });

    const kitchen = await getKitchenRoute(kitchenRequest());
    const count = await getPendingCountRoute();

    expect(kitchen.status).toBe(200);
    expect(kitchen.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await kitchen.json();
    expect(body.success).toBe(true);
    expect(body.data.active.map((o: { id: string }) => o.id)).toEqual([pending.id]);
    expect(body.data).not.toHaveProperty("history");
    expect(body.data.activeTruncated).toBe(false);

    expect(count.status).toBe(200);
    expect(count.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await count.json()).toEqual({ success: true, data: { pending: 1 } });
  });

  it("adds the shop's recent history when asked with history=1", async () => {
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    const client = await createTestUser();
    const pending = await orderAt(shop.id, client.id, "PENDING", minutesAgo(5));
    const done = await orderAt(shop.id, client.id, "PICKED_UP", minutesAgo(15));
    await orderAt(otherShop.id, client.id, "COMPLETED", minutesAgo(1));
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      userId: shop.ownerId,
      shopId: shop.id,
    });

    const kitchen = await getKitchenRoute(kitchenRequest("?history=1"));

    expect(kitchen.status).toBe(200);
    expect(kitchen.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await kitchen.json();
    expect(body.data.active.map((o: { id: string }) => o.id)).toEqual([pending.id]);
    expect(body.data.history.map((o: { id: string }) => o.id)).toEqual([done.id]);
  });

  it.each(["?history=0", "?history=yes", "?foo=1"])(
    "refuses the query %s with 400",
    async (query) => {
      const shop = await createTestShop();
      boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
        userId: shop.ownerId,
        shopId: shop.id,
      });

      const kitchen = await getKitchenRoute(kitchenRequest(query));

      expect(kitchen.status).toBe(400);
      expect(kitchen.headers.get("Cache-Control")).toBe("private, no-store");
    }
  );
});
