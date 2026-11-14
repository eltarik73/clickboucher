// @vitest-environment node
// Actions du boucher sur une commande, par la route unifiée et la route du scanner, sur PostgreSQL
// réel : une transition conditionnelle par action, un événement et une notification par
// transition, rejeu idempotent, conflits, isolation entre boutiques, stock limité, ruptures.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderStatus } from "@prisma/client";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-receipt", () => ({ sendOrderReceiptEmail: vi.fn(async () => true) }));

import { sendOrderReceiptEmail } from "@/lib/emails/order-receipt";
import { PATCH as actionRoute } from "@/app/api/boucher/orders/[orderId]/action/route";
import { POST as scannerRoute } from "@/app/api/boucher/orders/pickup/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestProduct, createTestShop } from "../helpers/factories";
import {
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

const QR = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

beforeEach(() => {
  boucherAuth.getAuthenticatedBoucher.mockReset();
  vi.mocked(sendOrderReceiptEmail).mockClear();
});

function actAs(world: World) {
  boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
    userId: world.owner.clerkId,
    shopId: world.shop.id,
  });
}

async function act(orderId: string, body: Record<string, unknown>) {
  return readResponse(
    await actionRoute(jsonRequest(`/api/boucher/orders/${orderId}/action`, "PATCH", body), {
      params: { orderId },
    })
  );
}

async function scan(qrCode: string) {
  return readResponse(
    await scannerRoute(jsonRequest("/api/boucher/orders/pickup", "POST", { qrCode }))
  );
}

interface ActionCase {
  name: string;
  from: OrderStatus;
  body: Record<string, unknown>;
  to: OrderStatus;
  event: string;
  notification: string;
}

const ACTION_CASES: ActionCase[] = [
  {
    name: "accept",
    from: "PENDING",
    body: { action: "accept", estimatedMinutes: 20 },
    to: "ACCEPTED",
    event: "ACCEPTED",
    notification: "ORDER_ACCEPTED",
  },
  {
    name: "start_preparing",
    from: "ACCEPTED",
    body: { action: "start_preparing" },
    to: "PREPARING",
    event: "PREPARING",
    notification: "ORDER_PREPARING",
  },
  {
    name: "mark_ready",
    from: "PREPARING",
    body: { action: "mark_ready" },
    to: "READY",
    event: "READY",
    notification: "ORDER_READY",
  },
  {
    name: "manual_pickup",
    from: "READY",
    body: { action: "manual_pickup" },
    to: "PICKED_UP",
    event: "PICKED_UP",
    notification: "ORDER_PICKED_UP",
  },
  {
    name: "confirm_pickup (QR)",
    from: "READY",
    body: { action: "confirm_pickup", qrCode: QR },
    to: "PICKED_UP",
    event: "PICKED_UP",
    notification: "ORDER_PICKED_UP",
  },
  {
    name: "deny",
    from: "PENDING",
    body: { action: "deny", reason: "Fermeture exceptionnelle" },
    to: "DENIED",
    event: "DENIED",
    notification: "ORDER_DENIED",
  },
  {
    name: "cancel",
    from: "ACCEPTED",
    body: { action: "cancel", reason: "Panne de vitrine" },
    to: "CANCELLED",
    event: "CANCELLED",
    notification: "ORDER_CANCELLED",
  },
];

describe("each action: one transition, one event, one notification; the replay changes nothing", () => {
  it.each(ACTION_CASES)("$name: $from -> $to", async (testCase) => {
    const world = await createWorld();
    actAs(world);
    const order = await createOrder(world, { status: testCase.from, overrides: { qrCode: QR } });

    const first = await act(order.id, testCase.body);
    expect(first.status).toBe(200);
    expect(first.body.data?._idempotent).toBeUndefined();
    expect((await reload(order.id)).status).toBe(testCase.to);

    const replay = await act(order.id, testCase.body);
    expect(replay.status).toBe(200);
    expect(replay.body.data?._idempotent).toBe(true);
    expect(replay.body.data?.status).toBe(testCase.to);

    expect(await eventsOf(order.id, testCase.event)).toHaveLength(1);
    expect(await notificationsOf(world.customer.id, testCase.notification)).toHaveLength(1);
    const receipts = testCase.to === "PICKED_UP" ? 1 : 0;
    expect(sendOrderReceiptEmail).toHaveBeenCalledTimes(receipts);
  });

  it("the scanner route picks up by QR code, sends the receipt, and replays", async () => {
    const world = await createWorld();
    actAs(world);
    const order = await createOrder(world, { status: "READY", overrides: { qrCode: QR } });

    const first = await scan(QR);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      orderId: order.id,
      clientName: "Fatima.A",
      itemCount: 1,
    });
    const replay = await scan(QR);
    expect(replay.status).toBe(200);
    expect(replay.body.data?._idempotent).toBe(true);

    const stored = await reload(order.id);
    expect(stored.status).toBe("PICKED_UP");
    expect(stored.qrScannedAt).not.toBeNull();
    expect(await eventsOf(order.id, "PICKED_UP")).toHaveLength(1);
    expect(await notificationsOf(world.customer.id, "ORDER_PICKED_UP")).toHaveLength(1);
    expect(sendOrderReceiptEmail).toHaveBeenCalledTimes(1);
  });
});

describe("refusals change nothing", () => {
  it("an action the current status does not allow is a 409 with the current status", async () => {
    const world = await createWorld();
    actAs(world);
    const order = await createOrder(world);

    const result = await act(order.id, { action: "mark_ready" });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatchObject({
      code: "CONFLICT",
      details: { currentStatus: ["PENDING"] },
    });
    expect((await reload(order.id)).status).toBe("PENDING");
    expect(await eventsOf(order.id)).toHaveLength(0);
  });

  it("an order of another shop is not found and stays unchanged", async () => {
    const world = await createWorld();
    const otherShop = await createTestShop();
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      userId: "user_other",
      shopId: otherShop.id,
    });
    const order = await createOrder(world);

    for (const body of [
      { action: "accept", estimatedMinutes: 10 },
      { action: "deny", reason: "x" },
      { action: "add_note", note: "x" },
    ]) {
      const result = await act(order.id, body);
      expect(result.status).toBe(404);
    }
    const stored = await reload(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.boucherNote).toBeNull();
    expect(await eventsOf(order.id)).toHaveLength(0);
  });

  it("a wrong QR code changes nothing, by the action and by the scanner", async () => {
    const world = await createWorld();
    actAs(world);
    const order = await createOrder(world, { status: "READY", overrides: { qrCode: QR } });
    const wrong = "2c8e7bde-ccfe-4c3e-8c6e-bc9efccd5cfe";

    expect((await act(order.id, { action: "confirm_pickup", qrCode: wrong })).status).toBe(400);
    expect((await scan(wrong)).status).toBe(404);
    expect((await reload(order.id)).status).toBe("READY");
    expect(await eventsOf(order.id)).toHaveLength(0);
    expect(sendOrderReceiptEmail).not.toHaveBeenCalled();
  });

  it("the schema refuses adjust_weight and adjust_price", async () => {
    const world = await createWorld();
    actAs(world);
    const order = await createOrder(world, { status: "ACCEPTED" });
    const before = await reload(order.id);

    const weight = await act(order.id, {
      action: "adjust_weight",
      items: [{ orderItemId: order.items[0].id, actualWeightGrams: 2000 }],
    });
    const price = await act(order.id, {
      action: "adjust_price",
      items: [{ orderItemId: order.items[0].id, newPriceCents: 1 }],
    });
    expect([weight.status, price.status]).toEqual([400, 400]);
    expect(await reload(order.id)).toEqual(before);
  });
});

describe("limited stock", () => {
  async function antiGaspiWorld(stock: number) {
    const world = await createWorld();
    actAs(world);
    const product = await createTestProduct(world.shop.id, {
      isAntiGaspi: true,
      antiGaspiStock: stock,
      antiGaspiOrigPriceCents: 2500,
    });
    const order = await createOrder(world, {
      items: [{ productId: product.id, ...THREE_PORTIONS }],
    });
    const stockOf = async () =>
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).antiGaspiStock;
    return { world, product, order, stockOf };
  }

  it("accept takes one unit per portion, never kilograms", async () => {
    const { order, stockOf } = await antiGaspiWorld(5);
    expect((await act(order.id, { action: "accept", estimatedMinutes: 15 })).status).toBe(200);
    expect(await stockOf()).toBe(2);
  });

  it("an underflow refuses the acceptance and leaves the order PENDING", async () => {
    const { order, stockOf } = await antiGaspiWorld(2);
    const result = await act(order.id, { action: "accept", estimatedMinutes: 15 });
    expect(result.status).toBe(422);
    expect(result.body.error?.code).toBe("STOCK_INSUFFICIENT");
    const stored = await reload(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.qrCode).toBeNull();
    expect(await stockOf()).toBe(2);
    expect(await eventsOf(order.id)).toHaveLength(0);
  });

  it("a stock brought to exactly 0 refuses the next acceptances, in sequence or in parallel", async () => {
    const world = await createWorld();
    actAs(world);
    const trays = await createTestProduct(world.shop.id, {
      unit: "BARQUETTE",
      priceCents: 524,
      isAntiGaspi: true,
      antiGaspiStock: 6,
      antiGaspiOrigPriceCents: 749,
    });
    const orders = await Promise.all(
      Array.from({ length: 4 }, () =>
        createOrder(world, {
          items: [
            {
              productId: trays.id,
              quantity: 3,
              weightGrams: null,
              priceCents: 524,
              totalCents: 1572,
            },
          ],
        })
      )
    );

    const results = await Promise.all(
      orders.map((order) => act(order.id, { action: "accept", estimatedMinutes: 15 }))
    );

    expect(results.map((result) => result.status).sort()).toEqual([200, 200, 422, 422]);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: trays.id } })).toMatchObject({
      isAntiGaspi: true,
      antiGaspiStock: 0,
      priceCents: 524,
    });
    const refused = orders.filter((_order, index) => results[index].status === 422);
    for (const order of refused) {
      expect((await act(order.id, { action: "accept", estimatedMinutes: 15 })).status).toBe(422);
      expect((await reload(order.id)).status).toBe("PENDING");
    }
  });

  it("deny from PENDING gives nothing back", async () => {
    const { order, stockOf } = await antiGaspiWorld(5);
    expect((await act(order.id, { action: "deny", reason: "Fermé" })).status).toBe(200);
    expect(await stockOf()).toBe(5);
  });

  it.each([
    ["deny", { action: "deny", reason: "Fermé" }],
    ["cancel", { action: "cancel" }],
  ])(
    "%s from ACCEPTED gives back exactly the reserved units, even after a weight adjustment",
    async (_name, body) => {
      const { order, stockOf } = await antiGaspiWorld(5);
      await act(order.id, { action: "accept", estimatedMinutes: 15 });
      expect(await stockOf()).toBe(2);
      // The butcher weighed 1,62 kg: the line no longer splits into its three 500 g portions.
      await prisma.orderItem.update({ where: { id: order.items[0].id }, data: { quantity: 1.62 } });

      expect((await act(order.id, body)).status).toBe(200);
      expect(await stockOf()).toBe(5);
    }
  );
});

describe("out-of-stock lines", () => {
  async function twoLineOrder(world: World, overrides: Record<string, unknown> = {}) {
    const piece = await createTestProduct(world.shop.id, { unit: "PIECE", priceCents: 500 });
    return createOrder(world, {
      items: [{ productId: world.product.id }, { productId: piece.id }],
      totalCents: 1911 + 500 - 100,
      overrides: { discountCents: 100, ...overrides },
    });
  }

  it("the total becomes the available lines minus the stored discount; the discount stays", async () => {
    const world = await createWorld();
    actAs(world);
    const order = await twoLineOrder(world);
    const missing = order.items[1].productId;

    const result = await act(order.id, { action: "item_unavailable", itemIds: [missing] });
    expect(result.status).toBe(200);
    const stored = await reload(order.id);
    expect(stored.status).toBe("PARTIALLY_DENIED");
    expect(stored.totalCents).toBe(1911 - 100);
    expect(stored.discountCents).toBe(100);
    expect(stored.items.find((item) => item.productId === missing)?.available).toBe(false);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: missing } })).inStock).toBe(
      false
    );
    expect(await notificationsOf(world.customer.id, "STOCK_ISSUE")).toHaveLength(1);

    const replay = await act(order.id, { action: "item_unavailable", itemIds: [missing] });
    expect(replay.body.data?._idempotent).toBe(true);
    expect(await eventsOf(order.id, "ITEM_UNAVAILABLE")).toHaveLength(1);
  });

  it("when every line is missing the order is DENIED and the offer use is released", async () => {
    const world = await createWorld();
    actAs(world);
    const offer = await createTestOffer({ currentUses: 1, maxUses: 10 });
    const order = await twoLineOrder(world, { offerId: offer.id });

    const result = await act(order.id, {
      action: "item_unavailable",
      itemIds: order.items.map((item) => item.productId),
    });
    expect(result.status).toBe(200);
    const stored = await reload(order.id);
    expect(stored.status).toBe("DENIED");
    expect(stored.totalCents).toBe(0);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
    expect(await notificationsOf(world.customer.id, "ORDER_DENIED")).toHaveLength(1);
  });
});
