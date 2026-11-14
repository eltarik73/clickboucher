// @vitest-environment node
// Promo codes on real PostgreSQL: the server alone decides the discount, a refused code never
// produces an order at full price, and a use is consumed once under concurrency.
import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

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
import { confirmedBody, customerOf, quoteOf, quoteRequest } from "./create-order-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;
const PARALLEL_CUSTOMERS = 5;

/** 2 × 500 g at 19,11 €/kg: subtotal 1912 cents. */
async function basket() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id);
  const user = await createTestUser();
  const items = [{ productId: beef.id, quantity: 2, weightGrams: 500 }];
  return { shop, user, customer: customerOf(user), items };
}

describe("resolveDiscount through the quote — applied", () => {
  it("applies a 10 % platform offer computed by the server", async () => {
    const { shop, customer, items } = await basket();
    const offer = await createTestOffer({ code: "DIX", discountValue: 10 });
    const quote = await quoteOf(quoteRequest(shop.id, items, " dix "), customer);
    expect(quote.discount).toEqual({ code: "DIX", label: offer.name, discountCents: 191 });
    expect(quote).toMatchObject({
      subtotalCents: 1912,
      totalCents: 1721,
      amountDueCents: 1721,
      discountRejection: null,
    });
  });

  it("applies a shop offer in its shop and a BUTCHER-paid platform offer where the proposal is accepted", async () => {
    const { shop, customer, items } = await basket();
    await createTestOffer({
      code: "MAISON",
      shopId: shop.id,
      payer: "BUTCHER",
      type: "AMOUNT",
      discountValue: 3,
    });
    const proposed = await createTestOffer({ code: "PROPOSEE", payer: "BUTCHER" });
    await prisma.offerProposal.create({
      data: { offerId: proposed.id, shopId: shop.id, status: "ACCEPTED" },
    });

    expect(
      (await quoteOf(quoteRequest(shop.id, items, "MAISON"), customer)).discount?.discountCents
    ).toBe(300);
    expect(
      (await quoteOf(quoteRequest(shop.id, items, "PROPOSEE"), customer)).discount?.discountCents
    ).toBe(191);
  });

  it("creates the order with the discount, its source and one use consumed", async () => {
    const { shop, customer, items } = await basket();
    const offer = await createTestOffer({ code: "DIX", shopId: shop.id, payer: "BUTCHER" });
    const result = await createOrder(
      await confirmedBody(quoteRequest(shop.id, items, "DIX"), customer),
      customer
    );
    expect(result).toMatchObject({
      ok: true,
      order: {
        totalCents: 1721,
        discountCents: 191,
        discountSource: "SHOP",
        offerId: offer.id,
        loyaltyRewardId: null,
      },
    });
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(1);
  });

  it("consumes the customer's loyalty reward with the order", async () => {
    const { shop, user, customer, items } = await basket();
    const reward = await prisma.loyaltyReward.create({
      data: {
        userId: user.id,
        tier: 3,
        rewardType: "FIXED",
        rewardCents: 200,
        code: "KG-FID001",
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
    const result = await createOrder(
      await confirmedBody(quoteRequest(shop.id, items, "KG-FID001"), customer),
      customer
    );
    expect(result).toMatchObject({
      ok: true,
      order: { totalCents: 1712, discountSource: "LOYALTY", loyaltyRewardId: reward.id },
    });
    const used = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } });
    expect(used.usedOnOrderId).toBe(result.ok ? result.order.id : null);
    expect(used.usedAt).toBeInstanceOf(Date);
  });
});

describe("resolveDiscount through the quote — refused with a French message", () => {
  const refusals: Array<
    [
      string,
      (
        shopId: string
      ) =>
        | Partial<Prisma.OfferUncheckedCreateInput>
        | Promise<Partial<Prisma.OfferUncheckedCreateInput>>,
      string,
    ]
  > = [
    [
      "an offer of another shop",
      async () => ({ shopId: (await createTestShop()).id, payer: "BUTCHER" }),
      "Ce code n'est pas valable dans cette boucherie",
    ],
    [
      "a BUTCHER-paid platform offer without an accepted proposal",
      () => ({ payer: "BUTCHER" }),
      "Ce code n'est pas valable dans cette boucherie",
    ],
    [
      "an offer under its minimum order",
      () => ({ minOrder: 30 }),
      "Ce code demande une commande minimum de 30,00",
    ],
    ["a BOGO offer", () => ({ type: "BOGO" }), "Cette offre n'est pas encore utilisable en ligne"],
    [
      "a FREE_FEES offer",
      () => ({ type: "FREE_FEES" }),
      "Cette commande n'a pas de frais de service",
    ],
    ["an expired offer", () => ({ endDate: new Date(Date.now() - DAY_MS) }), "Ce code a expiré"],
    [
      "an exhausted offer",
      () => ({ maxUses: 1, currentUses: 1 }),
      "Ce code a atteint sa limite d'utilisation",
    ],
  ];

  it.each(refusals)("refuses %s", async (_label, overridesFor, message) => {
    const { shop, customer, items } = await basket();
    await createTestOffer({ code: "REFUS", ...(await overridesFor(shop.id)) });
    const quote = await quoteOf(quoteRequest(shop.id, items, "REFUS"), customer);
    expect(quote.discount).toBeNull();
    expect(quote.discountRejection?.message).toContain(message);
    expect(quote.totalCents).toBe(1912);
  });

  it("refuses a guest and an anonymous visitor", async () => {
    const { shop, items } = await basket();
    await createTestOffer({ code: "DIX" });
    const guest = customerOf(await createTestUser({ clerkId: null, isGuest: true }));
    for (const customer of [guest, null]) {
      const quote = await quoteOf(quoteRequest(shop.id, items, "DIX"), customer);
      expect(quote.discountRejection?.message).toBe("Connectez-vous pour utiliser un code promo");
    }
  });

  it("refuses another customer's loyalty reward as an unknown code", async () => {
    const { shop, customer, items } = await basket();
    const owner = await createTestUser();
    await prisma.loyaltyReward.create({
      data: {
        userId: owner.id,
        tier: 3,
        rewardType: "FIXED",
        rewardCents: 200,
        code: "KG-AUTRE1",
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
    const quote = await quoteOf(quoteRequest(shop.id, items, "KG-AUTRE1"), customer);
    expect(quote.discount).toBeNull();
    expect(quote.discountRejection?.message).toBe("Code promo invalide");
  });

  it("never creates an order at full price when the code is refused", async () => {
    const { shop, customer, items } = await basket();
    await createTestOffer({ code: "BOGO1", type: "BOGO" });
    const request = quoteRequest(shop.id, items, "BOGO1");
    const quote = await quoteOf(request, customer);
    const fullPrice = {
      ...request,
      idempotencyKey: randomUUID(),
      expectedTotalCents: quote.amountDueCents,
    };

    const result = await createOrder(fullPrice, customer);

    expect(result).toMatchObject({
      ok: false,
      code: "PRICE_CHANGED",
      message: "Cette offre n'est pas encore utilisable en ligne",
    });
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("offer uses under concurrency", () => {
  it(`gives a maxUses 1 offer to exactly one of ${PARALLEL_CUSTOMERS} parallel customers`, async () => {
    const { shop, items } = await basket();
    const offer = await createTestOffer({ code: "UNIQUE", maxUses: 1 });
    const request = quoteRequest(shop.id, items, "UNIQUE");
    const customers = await Promise.all(
      Array.from({ length: PARALLEL_CUSTOMERS }, async () => customerOf(await createTestUser()))
    );
    const bodies = await Promise.all(customers.map((customer) => confirmedBody(request, customer)));

    const results = await Promise.all(
      bodies.map((body, index) => createOrder(body, customers[index]))
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "PRICE_CHANGED")).toHaveLength(
      PARALLEL_CUSTOMERS - 1
    );
    const orders = await prisma.order.findMany();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ offerId: offer.id, discountCents: 191 });
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(1);
  });

  it("refuses a second order of the same customer with the same code", async () => {
    const { shop, customer, items } = await basket();
    await createTestOffer({ code: "UNEFOIS" });
    const request = quoteRequest(shop.id, items, "UNEFOIS");
    const first = await createOrder(await confirmedBody(request, customer), customer);
    expect(first.ok).toBe(true);

    const quote = await quoteOf(request, customer);
    expect(quote.discountRejection?.message).toBe("Vous avez déjà utilisé ce code");
    const second = await createOrder(
      { ...request, idempotencyKey: randomUUID(), expectedTotalCents: quote.amountDueCents },
      customer
    );
    expect(second).toMatchObject({
      ok: false,
      code: "PRICE_CHANGED",
      message: "Vous avez déjà utilisé ce code",
    });
    expect(await prisma.order.count()).toBe(1);
  });

  it("lets only one of two parallel orders of the same customer use the code", async () => {
    const { shop, customer, items } = await basket();
    const offer = await createTestOffer({ code: "UNEFOIS" });
    const request = quoteRequest(shop.id, items, "UNEFOIS");
    const bodies = [await confirmedBody(request, customer), await confirmedBody(request, customer)];

    const results = await Promise.all(bodies.map((body) => createOrder(body, customer)));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "PRICE_CHANGED")).toHaveLength(
      1
    );
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(1);
  });
});
