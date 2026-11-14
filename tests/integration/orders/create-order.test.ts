// @vitest-environment node
// Order creation on real PostgreSQL: stored lines and totals come from the server's quote, the body
// can carry no amount, a stale total creates nothing, customer numbers are per shop, auto-accept
// reserves limited stock, and every order alerts the butcher.
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

import { sendOrderConfirmationEmail } from "@/lib/emails/order-confirmation";
import { cancelOrderByShop } from "@/lib/services/orders/commands/close";
import { createOrder } from "@/lib/services/orders/create";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { confirmedBody, customerOf, quoteOf, quoteRequest } from "./create-order-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const STALE_CART =
  "Votre panier n'est plus à jour. Rechargez la page puis validez à nouveau votre commande.";

beforeEach(() => {
  vi.mocked(sendOrderConfirmationEmail).mockClear();
});

async function counters() {
  const [orderNumbers, daily, customers, shopCustomers, orders] = await Promise.all([
    prisma.orderNumberCounter.findMany({ orderBy: { year: "asc" } }),
    prisma.dailyCounter.findMany({ orderBy: { shopId: "asc" } }),
    prisma.customerCounter.findMany({ orderBy: { shopId: "asc" } }),
    prisma.shopCustomer.count(),
    prisma.order.count(),
  ]);
  return { orderNumbers, daily, customers, shopCustomers, orders };
}

async function setup() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id, {
    name: "Entrecôte",
    unit: "KG",
    priceCents: 1911,
  });
  const user = await createTestUser({ firstName: "Fatima" });
  return { shop, beef, user, customer: customerOf(user) };
}

describe("createOrder — the order is the quote", () => {
  it("stores totals and lines from the quote, quantity in kilograms and weight per portion", async () => {
    const { shop, beef, customer } = await setup();
    const request = quoteRequest(shop.id, [
      { productId: beef.id, quantity: 1, weightGrams: 500 },
      { productId: beef.id, quantity: 2, weightGrams: 500 },
    ]);
    const quote = await quoteOf(request, customer);
    const body = await confirmedBody(request, customer);

    const result = await createOrder(body, customer);
    expect(result).toMatchObject({ ok: true, status: 201 });
    if (!result.ok) return;

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
      include: { items: { orderBy: { quantity: "asc" } } },
    });
    expect(order.totalCents).toBe(quote.totalCents);
    expect(order.totalCents).toBe(956 + 1912);
    expect(order.serviceFeeCents).toBe(0);
    expect(order.customerNumber).toBe(1);
    expect(order.orderNumber).toMatch(/^KG\d{2}-\d{6}$/);
    expect(order.status).toBe("PENDING");
    expect(
      order.items.map((item) => [item.quantity, item.weightGrams, item.priceCents, item.totalCents])
    ).toEqual([
      [0.5, 500, 1911, 956],
      [1, 500, 1911, 1912],
    ]);
  });

  it("writes the cut price from the database, never from the body", async () => {
    const { shop, customer } = await setup();
    const beef = await createTestProduct(shop.id, {
      cutOptions: [{ name: "Haché", priceCents: 2200 }],
    });
    const request = quoteRequest(shop.id, [
      { productId: beef.id, quantity: 1, weightGrams: 1000, cutOption: "Haché" },
    ]);
    const result = await createOrder(await confirmedBody(request, customer), customer);
    expect(result.ok).toBe(true);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { productId: beef.id } });
    expect(item).toMatchObject({
      cutOption: "Haché",
      cutPriceCents: 2200,
      priceCents: 2200,
      totalCents: 2200,
    });
  });
});

describe("createOrder — the body carries no amount", () => {
  it.each([
    [
      "cutPriceCents on a line",
      (body: Record<string, unknown>, line: Record<string, unknown>) => (line.cutPriceCents = 1),
    ],
    ["discountCents", (body: Record<string, unknown>) => (body.discountCents = 500)],
    ["discountSource", (body: Record<string, unknown>) => (body.discountSource = "PLATFORM")],
    ["offerId", (body: Record<string, unknown>) => (body.offerId = "offer-1")],
    ["loyaltyRewardId", (body: Record<string, unknown>) => (body.loyaltyRewardId = "reward-1")],
    [
      "a fractional quantity",
      (_body: Record<string, unknown>, line: Record<string, unknown>) => (line.quantity = 0.5),
    ],
  ])("refuses a body with %s and creates nothing", async (_label, tamper) => {
    const { shop, beef, customer } = await setup();
    const body = (await confirmedBody(
      quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
      customer
    )) as unknown as Record<string, unknown>;
    tamper(body, (body.items as Array<Record<string, unknown>>)[0]);

    const result = await createOrder(body, customer);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("refuses online payment with the French message and creates nothing", async () => {
    const { shop, beef, customer } = await setup();
    const body = await confirmedBody(
      quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
      customer
    );

    const result = await createOrder({ ...body, paymentMethod: "ONLINE" }, customer);

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(result.ok === false && result.details?.paymentMethod).toEqual([
      "Le paiement en ligne n'est pas encore disponible. Réglez sur place au retrait.",
    ]);
    expect(await prisma.order.count()).toBe(0);
  });

  it.each(["idempotencyKey", "expectedTotalCents"])(
    "refuses a body without %s as a stale cart",
    async (field) => {
      const { shop, beef, customer } = await setup();
      const body = (await confirmedBody(
        quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
        customer
      )) as unknown as Record<string, unknown>;
      delete body[field];

      const result = await createOrder(body, customer);
      expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", message: STALE_CART });
      expect(result.ok === false && result.details).toHaveProperty([field]);
      expect(await prisma.order.count()).toBe(0);
    }
  );
});

describe("createOrder — a total the server does not confirm creates nothing", () => {
  it("answers PRICE_CHANGED on a wrong expectedTotalCents and leaves every counter and the offer untouched", async () => {
    const { shop, beef, customer } = await setup();
    const offer = await createTestOffer({ code: "DIX", discountValue: 10 });
    // A first order makes every counter exist, so "unchanged" compares real rows.
    const first = await createOrder(
      await confirmedBody(
        quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
        customer
      ),
      customer
    );
    expect(first.ok).toBe(true);
    const before = await counters();

    const request = quoteRequest(
      shop.id,
      [{ productId: beef.id, quantity: 2, weightGrams: 500 }],
      offer.code
    );
    const body = await confirmedBody(request, customer);
    const result = await createOrder(
      { ...body, expectedTotalCents: body.expectedTotalCents + 1 },
      customer
    );

    expect(result).toMatchObject({
      ok: false,
      code: "PRICE_CHANGED",
      message:
        "Les prix ou la disponibilité ont changé. Vérifiez le nouveau total avant de confirmer.",
    });
    expect(await counters()).toEqual(before);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
  });

  it("answers VALIDATION_ERROR under the minimum order", async () => {
    const shop = await createTestShop({ minOrderCents: 1500 });
    const beef = await createTestProduct(shop.id);
    const customer = customerOf(await createTestUser());
    const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]);
    const result = await createOrder(
      { ...request, idempotencyKey: randomUUID(), expectedTotalCents: 956 },
      customer
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(result.ok === false && result.message).toMatch(/^Commande minimum de 15,00/);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("createOrder — customer numbers belong to a shop", () => {
  it("numbers new customers 1 and 1 in two shops, then gives the first a new number in the second shop", async () => {
    const shopA = await createTestShop();
    const shopB = await createTestShop();
    const beefA = await createTestProduct(shopA.id);
    const beefB = await createTestProduct(shopB.id);
    const alice = await createTestUser();
    const bob = await createTestUser();
    const line = (productId: string) => [{ productId, quantity: 1, weightGrams: 500 }];

    const results = [];
    for (const [user, shopId, productId] of [
      [alice, shopA.id, beefA.id],
      [bob, shopB.id, beefB.id],
      [alice, shopB.id, beefB.id],
    ] as const) {
      const customer = customerOf(user);
      results.push(
        await createOrder(
          await confirmedBody(quoteRequest(shopId, line(productId)), customer),
          customer
        )
      );
    }

    expect(results.map((result) => result.ok)).toEqual([true, true, true]);
    const numbers = results.map((result) => (result.ok ? result.order.customerNumber : null));
    expect(numbers[0]).toBe(1);
    expect(numbers[1]).toBe(1);
    expect(numbers[2]).toBe(2);
    expect(await prisma.shopCustomer.count()).toBe(3);
    const users = await prisma.user.findMany({ where: { id: { in: [alice.id, bob.id] } } });
    expect(users.map((user) => user.customerNumber)).toEqual([null, null]);
  });

  it("keeps the customer's number on a second order in the same shop", async () => {
    const { shop, beef, customer } = await setup();
    const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]);
    const first = await createOrder(await confirmedBody(request, customer), customer);
    const second = await createOrder(await confirmedBody(request, customer), customer);
    expect(
      first.ok && second.ok && [first.order.customerNumber, second.order.customerNumber]
    ).toEqual([1, 1]);
  });
});

describe("createOrder — auto-accept and limited stock", () => {
  it("accepts with a QR code and decrements the limited stock", async () => {
    const shop = await createTestShop({ autoAccept: true });
    const product = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 300,
      isFlashSale: true,
      flashSaleStock: 5,
    });
    const customer = customerOf(await createTestUser());
    const result = await createOrder(
      await confirmedBody(
        quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }]),
        customer
      ),
      customer
    );
    expect(result).toMatchObject({
      ok: true,
      status: 201,
      order: { status: "ACCEPTED", expiresAt: null },
    });
    expect(result.ok && result.order.qrCode).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.ok && result.order.estimatedReady).toBeInstanceOf(Date);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).flashSaleStock
    ).toBe(3);
  });

  it("answers STOCK_INSUFFICIENT when the limited stock runs out and creates nothing", async () => {
    const shop = await createTestShop({ autoAccept: true });
    const product = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 300,
      isFlashSale: true,
      flashSaleStock: 2,
    });
    const customer = customerOf(await createTestUser());
    const body = await confirmedBody(
      quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }]),
      customer
    );
    // Someone else takes one unit between the quote and the order.
    await prisma.product.update({ where: { id: product.id }, data: { flashSaleStock: 1 } });

    const result = await createOrder(body, customer);
    expect(result).toMatchObject({ ok: false, code: "STOCK_INSUFFICIENT" });
    expect(await prisma.order.count()).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).flashSaleStock
    ).toBe(1);
  });

  it("refuses inside the transaction when the reservation underflows after the quote passed", async () => {
    const shop = await createTestShop({ autoAccept: true });
    const product = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 300,
      isFlashSale: true,
      flashSaleStock: 3,
    });
    const alice = customerOf(await createTestUser());
    const bob = customerOf(await createTestUser());
    const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }]);
    const [aliceBody, bobBody] = [
      await confirmedBody(request, alice),
      await confirmedBody(request, bob),
    ];

    const results = await Promise.all([createOrder(aliceBody, alice), createOrder(bobBody, bob)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results.filter((result) => !result.ok && result.code === "STOCK_INSUFFICIENT")
    ).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).flashSaleStock
    ).toBe(1);
  });
});

describe("createOrder — auto-accept records the units it reserves", () => {
  it("gives back every reserved unit when an auto-accepted order is cancelled after a weight adjustment", async () => {
    const shop = await createTestShop({ autoAccept: true });
    const product = await createTestProduct(shop.id, {
      unit: "KG",
      priceCents: 1911,
      isAntiGaspi: true,
      antiGaspiStock: 5,
    });
    const customer = customerOf(await createTestUser());
    const created = await createOrder(
      await confirmedBody(
        quoteRequest(shop.id, [{ productId: product.id, quantity: 3, weightGrams: 500 }]),
        customer
      ),
      customer
    );
    expect(created).toMatchObject({ ok: true, order: { status: "ACCEPTED" } });
    if (!created.ok) return;
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).antiGaspiStock
    ).toBe(2);

    // The butcher weighs 1.47 kg instead of 3 × 500 g: the line no longer splits into its portions.
    await prisma.orderItem.updateMany({
      where: { orderId: created.order.id },
      data: { quantity: 1.47 },
    });
    const cancelled = await cancelOrderByShop({
      orderId: created.order.id,
      shopId: shop.id,
      actorId: "butcher",
    });
    expect(cancelled.kind).toBe("done");

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).antiGaspiStock
    ).toBe(5);
    const accepted = await prisma.orderEvent.findMany({
      where: { orderId: created.order.id, type: "ACCEPTED" },
    });
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      actorId: "system",
      payloadJson: {
        auto: true,
        qrCode: created.order.qrCode,
        stockUnits: [{ productId: product.id, units: 3 }],
      },
    });
  });
});

describe("createOrder — the butcher is alerted for every order", () => {
  it("creates two ORDER_PENDING notifications for two orders within a minute, and sends the e-mail", async () => {
    const owner = await createTestUser({ role: "BOUCHER" });
    const shop = await createTestShop({ ownerId: owner.clerkId as string });
    const beef = await createTestProduct(shop.id);
    const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]);
    for (const user of [await createTestUser(), await createTestUser()]) {
      const customer = customerOf(user);
      expect((await createOrder(await confirmedBody(request, customer), customer)).ok).toBe(true);
    }

    const notifications = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(
      notifications.filter((notification) => notification.type === "ORDER_PENDING")
    ).toHaveLength(2);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(2);
  });

  it("creates the order when the confirmation e-mail fails", async () => {
    vi.mocked(sendOrderConfirmationEmail).mockRejectedValueOnce(new Error("Resend down"));
    const { shop, beef, customer } = await setup();
    const result = await createOrder(
      await confirmedBody(
        quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
        customer
      ),
      customer
    );
    expect(result).toMatchObject({ ok: true, status: 201 });
    expect(await prisma.order.count()).toBe(1);
  });
});
