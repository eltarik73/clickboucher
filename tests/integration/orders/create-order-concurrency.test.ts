// @vitest-environment node
// Order creation under concurrency, on real PostgreSQL: numbers are allocated inside the order
// transaction (no read-max-plus-one), and an idempotency key creates one order whatever the number
// of retries, for its own customer only.
import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

import { createOrder } from "@/lib/services/orders/create";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { confirmedBody, customerOf, quoteRequest } from "./create-order-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const PARALLEL_ORDERS = 20;
const RETRIES = 6;

async function shopWithBeef() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id);
  const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]);
  return { shop, request };
}

describe("createOrder — parallel orders in one shop", () => {
  it(`creates ${PARALLEL_ORDERS} orders with distinct order numbers and daily numbers 1..${PARALLEL_ORDERS}`, async () => {
    const { shop, request } = await shopWithBeef();
    const customers = await Promise.all(
      Array.from({ length: PARALLEL_ORDERS }, async () => customerOf(await createTestUser()))
    );
    const bodies = await Promise.all(customers.map((customer) => confirmedBody(request, customer)));

    const results = await Promise.all(
      bodies.map((body, index) => createOrder(body, customers[index]))
    );

    expect(results.filter((result) => !result.ok)).toEqual([]);
    const orders = await prisma.order.findMany({ where: { shopId: shop.id } });
    expect(orders).toHaveLength(PARALLEL_ORDERS);
    expect(new Set(orders.map((order) => order.orderNumber)).size).toBe(PARALLEL_ORDERS);
    expect(orders.map((order) => order.dailyNumber).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: PARALLEL_ORDERS }, (_, index) => index + 1)
    );
    expect(new Set(orders.map((order) => order.customerNumber)).size).toBe(PARALLEL_ORDERS);
  });
});

describe("createOrder — idempotency key", () => {
  it(`creates one order when the same key and customer are sent ${RETRIES} times in parallel`, async () => {
    const { shop, request } = await shopWithBeef();
    const customer = customerOf(await createTestUser());
    const body = await confirmedBody(request, customer);

    const results = await Promise.all(
      Array.from({ length: RETRIES }, () => createOrder(body, customer))
    );

    expect(results.every((result) => result.ok)).toBe(true);
    const ids = new Set(results.map((result) => (result.ok ? result.order.id : null)));
    expect(ids.size).toBe(1);
    const statuses = results.map((result) => (result.ok ? result.status : null)).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 201]);
    expect(await prisma.order.count({ where: { shopId: shop.id } })).toBe(1);
  });

  it("returns the order created first when the same customer retries later", async () => {
    const { request } = await shopWithBeef();
    const customer = customerOf(await createTestUser());
    const body = await confirmedBody(request, customer);
    const first = await createOrder(body, customer);
    const retry = await createOrder(body, customer);
    expect(first).toMatchObject({ ok: true, status: 201 });
    expect(retry).toMatchObject({ ok: true, status: 200 });
    expect(retry.ok && first.ok && retry.order.id === first.order.id).toBe(true);
  });

  it("answers CONFLICT without order data when another customer presents the same key", async () => {
    const { request } = await shopWithBeef();
    const owner = customerOf(await createTestUser());
    const intruder = customerOf(await createTestUser());
    const idempotencyKey = randomUUID();
    const created = await createOrder(
      await confirmedBody(request, owner, { idempotencyKey }),
      owner
    );
    expect(created.ok).toBe(true);

    const result = await createOrder(
      await confirmedBody(request, intruder, { idempotencyKey }),
      intruder
    );

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Cette demande a déjà été utilisée",
    });
    expect(await prisma.order.count()).toBe(1);
  });

  it("answers CONFLICT to the other customer when both race on the same key", async () => {
    const { request } = await shopWithBeef();
    const alice = customerOf(await createTestUser());
    const bob = customerOf(await createTestUser());
    const idempotencyKey = randomUUID();
    const [aliceBody, bobBody] = [
      await confirmedBody(request, alice, { idempotencyKey }),
      await confirmedBody(request, bob, { idempotencyKey }),
    ];

    const results = await Promise.all([createOrder(aliceBody, alice), createOrder(bobBody, bob)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, code: "CONFLICT", message: "Cette demande a déjà été utilisée" },
    ]);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe("createOrder — idempotency key with a promo code", () => {
  async function shopWithBeefAndCode(offerOverrides: { maxUses?: number } = {}) {
    const shop = await createTestShop();
    const beef = await createTestProduct(shop.id);
    const offer = await createTestOffer({
      code: `DIX${randomUUID().slice(0, 8).toUpperCase()}`,
      discountValue: 10,
      ...offerOverrides,
    });
    const request = quoteRequest(
      shop.id,
      [{ productId: beef.id, quantity: 2, weightGrams: 500 }],
      offer.code
    );
    return { shop, offer, request };
  }

  it.each([
    ["without a use limit", {}],
    ["with maxUses 1", { maxUses: 1 }],
  ])(
    `replays the order to the ${RETRIES - 1} losers of a race on the same key and customer, %s`,
    async (_label, limits) => {
      const { shop, offer, request } = await shopWithBeefAndCode(limits);
      const customer = customerOf(await createTestUser());
      const body = await confirmedBody(request, customer);

      const results = await Promise.all(
        Array.from({ length: RETRIES }, () => createOrder(body, customer))
      );

      expect(results.filter((result) => !result.ok)).toEqual([]);
      const statuses = results.map((result) => (result.ok ? result.status : null)).sort();
      expect(statuses).toEqual([200, 200, 200, 200, 200, 201]);
      expect(new Set(results.map((result) => (result.ok ? result.order.id : null))).size).toBe(1);
      expect(await prisma.order.count({ where: { shopId: shop.id } })).toBe(1);
      expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(
        1
      );
    }
  );

  it("answers CONFLICT without order data to another customer racing with the same key and code", async () => {
    const { offer, request } = await shopWithBeefAndCode();
    const alice = customerOf(await createTestUser());
    const bob = customerOf(await createTestUser());
    const idempotencyKey = randomUUID();
    const [aliceBody, bobBody] = [
      await confirmedBody(request, alice, { idempotencyKey }),
      await confirmedBody(request, bob, { idempotencyKey }),
    ];

    const results = await Promise.all([createOrder(aliceBody, alice), createOrder(bobBody, bob)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, code: "CONFLICT", message: "Cette demande a déjà été utilisée" },
    ]);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(1);
  });
});
