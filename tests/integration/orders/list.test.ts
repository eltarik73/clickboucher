// @vitest-environment node
// The orders page of GET /api/orders on real PostgreSQL: a customer reads the customer view of
// their own orders, a butcher the orders of their shops only, an admin every order; the status and
// shop filters narrow a list and never widen it; a due price adjustment is closed before the read;
// 50 rows at most, newest first. The route resolves who reads (auth helpers mocked) and validates
// the query.
import { OrderStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

const session = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: async () => session.clerkId }));
const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);

import { GET as listRoute } from "@/app/api/orders/route";
import { listOrders, type OrderListViewer } from "@/lib/services/orders/list";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

// Not a React hook: the rule only looks at the « use » prefix of the name.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MINUTE_MS = 60_000;

beforeEach(() => {
  session.clerkId = null;
  boucherAuth.getAuthenticatedBoucher.mockReset();
});

function idsOf(rows: ReadonlyArray<{ id: string }>): string[] {
  return rows.map((row) => row.id).sort();
}

async function routeList(query = "") {
  const response = await listRoute(new NextRequest(`http://localhost/api/orders${query}`));
  return {
    status: response.status,
    body: (await response.json()) as {
      data?: Array<{ id: string }>;
      error?: { code: string; details?: Record<string, string[]> };
    },
  };
}

describe("listOrders", () => {
  it("a customer reads only their own orders, in the customer view", async () => {
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id);
    const customer = await createTestUser();
    const other = await createTestUser();
    const items = [{ productId: product.id }];
    const own = [
      await createTestOrder({ shopId: shop.id, userId: customer.id, items }),
      await createTestOrder({ shopId: shop.id, userId: customer.id, status: "READY" }),
    ];
    await createTestOrder({ shopId: shop.id, userId: other.id });

    const rows = await listOrders({ role: "CLIENT", userId: customer.id }, {}, new Date());

    expect(idsOf(rows)).toEqual(idsOf(own));
    const json = JSON.stringify(rows);
    expect(json).toContain(product.name);
    expect(json).not.toContain("ownerId");
    expect(json).not.toContain("commissionCents");
    expect(json).not.toContain("priceAdjustmentThreshold");
  });

  it("a butcher reads only the orders of their shops; a shop filter narrows, a foreign one does not widen", async () => {
    const customer = await createTestUser();
    const [first, second, foreign] = [
      await createTestShop(),
      await createTestShop(),
      await createTestShop(),
    ];
    const inFirst = await createTestOrder({ shopId: first.id, userId: customer.id });
    const inSecond = await createTestOrder({ shopId: second.id, userId: customer.id });
    await createTestOrder({ shopId: foreign.id, userId: customer.id });
    const butcher: OrderListViewer = { role: "BOUCHER", shopIds: [first.id, second.id] };
    const now = new Date();

    const all = await listOrders(butcher, {}, now);
    const narrowed = await listOrders(butcher, { shopId: second.id }, now);
    const widened = await listOrders(butcher, { shopId: foreign.id }, now);

    expect(idsOf(all)).toEqual(idsOf([inFirst, inSecond]));
    expect(idsOf(narrowed)).toEqual([inSecond.id]);
    expect(idsOf(widened)).toEqual(idsOf([inFirst, inSecond]));
  });

  it("an admin reads every order and can filter by shop", async () => {
    const [first, second] = [await createTestShop(), await createTestShop()];
    const orders = [
      await createTestOrder({ shopId: first.id, userId: (await createTestUser()).id }),
      await createTestOrder({ shopId: second.id, userId: (await createTestUser()).id }),
    ];
    const now = new Date();

    expect(idsOf(await listOrders({ role: "ADMIN" }, {}, now))).toEqual(idsOf(orders));
    expect(idsOf(await listOrders({ role: "ADMIN" }, { shopId: second.id }, now))).toEqual([
      orders[1].id,
    ]);
  });

  it("filters by status, PARTIALLY_DENIED included", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    await createTestOrder({ shopId: shop.id, userId: customer.id, status: "PENDING" });
    const ready = await createTestOrder({ shopId: shop.id, userId: customer.id, status: "READY" });
    const partial = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      status: "PARTIALLY_DENIED",
    });
    const viewer: OrderListViewer = { role: "CLIENT", userId: customer.id };
    const now = new Date();

    expect(idsOf(await listOrders(viewer, { status: "READY" }, now))).toEqual([ready.id]);
    expect(idsOf(await listOrders(viewer, { status: "PARTIALLY_DENIED" }, now))).toEqual([
      partial.id,
    ]);
  });

  it("closes a due price adjustment of the viewer's orders at the given time before reading them: silence is a refusal", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const other = await createTestUser();
    const deadline = new Date(Date.now() + 5 * MINUTE_MS);
    const [own, foreign] = [
      await createTestOrder({
        shopId: shop.id,
        userId: customer.id,
        status: "ACCEPTED",
        totalCents: 2000,
      }),
      await createTestOrder({ shopId: shop.id, userId: other.id, status: "ACCEPTED" }),
    ];
    for (const order of [own, foreign]) {
      await prisma.priceAdjustment.create({
        data: {
          orderId: order.id,
          shopId: shop.id,
          originalTotal: order.totalCents,
          newTotal: order.totalCents + 150,
          adjustmentType: "WEIGHT",
          tier: 3,
          answerBy: deadline,
        },
      });
    }

    const [row] = await listOrders(
      { role: "CLIENT", userId: customer.id },
      {},
      new Date(deadline.getTime() + MINUTE_MS)
    );

    expect(row.totalCents).toBe(2000);
    expect(row.priceAdjustment).toMatchObject({ status: "REJECTED", closeReason: "NO_ANSWER" });
    const untouched = await prisma.priceAdjustment.findUniqueOrThrow({
      where: { orderId: foreign.id },
    });
    expect(untouched.status).toBe("PENDING");
  });

  it("returns 50 orders at most, newest first, to every viewer", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const start = Date.now() - 60 * MINUTE_MS;
    const oldestFirst: string[] = [];
    for (let minute = 0; minute <= 50; minute += 1) {
      const createdAt = new Date(start + minute * MINUTE_MS);
      const order = await createTestOrder({
        shopId: shop.id,
        userId: customer.id,
        overrides: { createdAt },
      });
      oldestFirst.push(order.id);
    }
    const newestFirst = oldestFirst.reverse().slice(0, 50);
    const viewers: OrderListViewer[] = [
      { role: "CLIENT", userId: customer.id },
      { role: "BOUCHER", shopIds: [shop.id] },
      { role: "ADMIN" },
    ];

    for (const viewer of viewers) {
      const rows = await listOrders(viewer, {}, new Date());
      expect(rows.map((row) => row.id)).toEqual(newestFirst);
    }
  });
});

describe("GET /api/orders", () => {
  it("answers 400 VALIDATION_ERROR to an unknown status and accepts every order status", async () => {
    const customer = await createTestUser();
    session.clerkId = customer.clerkId;

    const refused = await routeList("?status=NOPE");

    expect(refused.status).toBe(400);
    expect(refused.body.error?.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(refused.body.error?.details ?? {})).toEqual(["status"]);
    for (const status of Object.values(OrderStatus)) {
      expect((await routeList(`?status=${status}`)).status).toBe(200);
    }
  });

  it("gives a butcher the shop their auth helper resolves, and no shop when it refuses", async () => {
    const owner = await createTestUser({ role: "BOUCHER" });
    const shop = await createTestShop({ ownerId: owner.id });
    const other = await createTestShop();
    const customer = await createTestUser();
    const order = await createTestOrder({ shopId: shop.id, userId: customer.id });
    await createTestOrder({ shopId: other.id, userId: customer.id });

    session.clerkId = owner.clerkId;
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({ userId: owner.id, shopId: shop.id });
    const resolved = await routeList(`?shopId=${other.id}`);
    session.clerkId = (await createTestUser({ role: "BOUCHER" })).clerkId;
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      error: new Response(null, { status: 404 }),
    });
    const shopless = await routeList();

    expect(idsOf(resolved.body.data ?? [])).toEqual([order.id]);
    expect(shopless.status).toBe(200);
    expect(shopless.body.data).toEqual([]);
  });

  it("reads every order for an admin", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const orders = [
      await createTestOrder({
        shopId: (await createTestShop()).id,
        userId: (await createTestUser()).id,
      }),
      await createTestOrder({
        shopId: (await createTestShop()).id,
        userId: (await createTestUser()).id,
      }),
    ];
    session.clerkId = admin.clerkId;

    expect(idsOf((await routeList()).body.data ?? [])).toEqual(idsOf(orders));
    expect(boucherAuth.getAuthenticatedBoucher).not.toHaveBeenCalled();
  });
});
