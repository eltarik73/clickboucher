// @vitest-environment node
// Promo code uses and loyalty rewards consumed and released inside order transactions, on real
// PostgreSQL, under concurrency.
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  consumeLoyaltyReward,
  consumeOffer,
  DiscountUnavailableError,
  releaseOrderDiscount,
} from "@/lib/services/orders/discount-ledger";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestOrder,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const PARALLEL_TX = { maxWait: 60_000, timeout: 60_000 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function inTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, PARALLEL_TX);
}

function reasonOf(result: PromiseSettledResult<unknown>): string | null {
  if (result.status === "fulfilled") return null;
  expect(result.reason).toBeInstanceOf(DiscountUnavailableError);
  return (result.reason as DiscountUnavailableError).reason;
}

let orderSequence = 0;

/** The order-creation transaction as C0-T8 runs it: consume the offer, then insert the order. */
function placeOrderWithOffer(shopId: string, userId: string, offerId: string, now = new Date()) {
  return inTx(async (tx) => {
    await consumeOffer(tx, { offerId, userId, now });
    orderSequence += 1;
    return tx.order.create({
      data: { orderNumber: `LEDGER-${orderSequence}`, shopId, userId, offerId, totalCents: 1000 },
    });
  });
}

async function offerUses(offerId: string): Promise<number> {
  return (await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).currentUses;
}

async function createReward(
  userId: string,
  overrides: Partial<Prisma.LoyaltyRewardUncheckedCreateInput> = {}
) {
  orderSequence += 1;
  return prisma.loyaltyReward.create({
    data: {
      userId,
      tier: 3,
      rewardType: "FIXED",
      rewardCents: 200,
      code: `KG-LEDG${orderSequence}`,
      expiresAt: new Date(Date.now() + 30 * DAY_MS),
      ...overrides,
    },
  });
}

describe("consumeOffer", () => {
  it("gives exactly one of five customers the last use (maxUses 1)", async () => {
    const shop = await createTestShop();
    const offer = await createTestOffer({ maxUses: 1 });
    const customers = [];
    for (let i = 0; i < 5; i += 1) customers.push(await createTestUser());

    const results = await Promise.allSettled(
      customers.map((c) => placeOrderWithOffer(shop.id, c.id, offer.id))
    );

    const reasons = results.map(reasonOf);
    expect(reasons.filter((r) => r === null)).toHaveLength(1);
    expect(reasons.filter((r) => r === "OFFER_NOT_REDEEMABLE")).toHaveLength(4);
    expect(await offerUses(offer.id)).toBe(1);
    expect(await prisma.order.count({ where: { offerId: offer.id } })).toBe(1);
  });

  it("lets the SAME customer use an unlimited offer once under five parallel orders", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer({ maxUses: null });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => placeOrderWithOffer(shop.id, customer.id, offer.id))
    );

    const reasons = results.map(reasonOf);
    expect(reasons.filter((r) => r === null)).toHaveLength(1);
    expect(reasons.filter((r) => r === "OFFER_ALREADY_USED")).toHaveLength(4);
    expect(await offerUses(offer.id)).toBe(1);
    expect(await prisma.order.count({ where: { offerId: offer.id } })).toBe(1);
  });

  it("counts several customers on an unlimited offer", async () => {
    const shop = await createTestShop();
    const offer = await createTestOffer({ maxUses: null });
    const customers = [await createTestUser(), await createTestUser(), await createTestUser()];

    await Promise.all(customers.map((c) => placeOrderWithOffer(shop.id, c.id, offer.id)));

    expect(await offerUses(offer.id)).toBe(3);
  });

  it("refuses an offer that is not ACTIVE or outside its window as OFFER_NOT_REDEEMABLE", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const now = new Date();
    const offers = [
      await createTestOffer({ status: "PAUSED" }),
      await createTestOffer({ status: "DRAFT" }),
      await createTestOffer({ status: "EXPIRED" }),
      await createTestOffer({
        startDate: new Date(now.getTime() + DAY_MS),
        endDate: new Date(now.getTime() + 2 * DAY_MS),
      }),
      await createTestOffer({
        startDate: new Date(now.getTime() - 2 * DAY_MS),
        endDate: new Date(now.getTime() - DAY_MS),
      }),
      await createTestOffer({ endDate: now }),
      await createTestOffer({ maxUses: 2, currentUses: 2 }),
    ];

    for (const offer of offers) {
      const result = await Promise.allSettled([
        placeOrderWithOffer(shop.id, customer.id, offer.id, now),
      ]);
      expect(reasonOf(result[0])).toBe("OFFER_NOT_REDEEMABLE");
      expect(await offerUses(offer.id)).toBe(offer.currentUses);
    }
    expect(await prisma.order.count()).toBe(0);
  });

  it("lets a customer use the offer again once the earlier order was cancelled", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer();
    for (const status of ["CANCELLED", "DENIED", "AUTO_CANCELLED"] as const) {
      await createTestOrder({
        shopId: shop.id,
        userId: customer.id,
        status,
        overrides: { offerId: offer.id },
      });
    }

    await placeOrderWithOffer(shop.id, customer.id, offer.id);

    expect(await offerUses(offer.id)).toBe(1);
  });

  it("rolls the increment back with the transaction when the customer already used the offer", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer({ currentUses: 1 });
    await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      status: "PICKED_UP",
      overrides: { offerId: offer.id },
    });

    const [result] = await Promise.allSettled([
      placeOrderWithOffer(shop.id, customer.id, offer.id),
    ]);

    expect(reasonOf(result)).toBe("OFFER_ALREADY_USED");
    expect(await offerUses(offer.id)).toBe(1);
  });
});

describe("consumeLoyaltyReward", () => {
  it("consumes a reward once under five parallel attempts", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const reward = await createReward(customer.id);
    const orders = [];
    for (let i = 0; i < 5; i += 1) {
      orders.push(await createTestOrder({ shopId: shop.id, userId: customer.id }));
    }
    const now = new Date();

    const results = await Promise.allSettled(
      orders.map((order) =>
        inTx((tx) =>
          consumeLoyaltyReward(tx, {
            rewardId: reward.id,
            userId: customer.id,
            orderId: order.id,
            now,
          })
        )
      )
    );

    const reasons = results.map(reasonOf);
    expect(reasons.filter((r) => r === null)).toHaveLength(1);
    expect(reasons.filter((r) => r === "REWARD_UNAVAILABLE")).toHaveLength(4);
    const stored = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } });
    const winner = orders[reasons.indexOf(null)];
    expect(stored.usedOnOrderId).toBe(winner.id);
    expect(stored.usedAt).toEqual(now);
  });

  it("refuses a reward of another customer, an expired one and a used one", async () => {
    const shop = await createTestShop();
    const [owner, stranger] = [await createTestUser(), await createTestUser()];
    const order = await createTestOrder({ shopId: shop.id, userId: stranger.id });
    const now = new Date();
    const cases = [
      { reward: await createReward(owner.id), userId: stranger.id },
      { reward: await createReward(stranger.id, { expiresAt: now }), userId: stranger.id },
      {
        reward: await createReward(stranger.id, { usedAt: new Date(now.getTime() - DAY_MS) }),
        userId: stranger.id,
      },
    ];

    for (const { reward, userId } of cases) {
      const [result] = await Promise.allSettled([
        inTx((tx) =>
          consumeLoyaltyReward(tx, { rewardId: reward.id, userId, orderId: order.id, now })
        ),
      ]);
      expect(reasonOf(result)).toBe("REWARD_UNAVAILABLE");
      expect(await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).toEqual(
        reward
      );
    }
  });
});

describe("releaseOrderDiscount", () => {
  it("makes the offer and the reward usable again", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer({ maxUses: 1 });
    const reward = await createReward(customer.id);
    const order = await placeOrderWithOffer(shop.id, customer.id, offer.id);
    const now = new Date();
    await inTx((tx) =>
      consumeLoyaltyReward(tx, { rewardId: reward.id, userId: customer.id, orderId: order.id, now })
    );
    const cancelled = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", loyaltyRewardId: reward.id },
    });

    await inTx((tx) => releaseOrderDiscount(tx, cancelled));

    expect(await offerUses(offer.id)).toBe(0);
    const freed = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } });
    expect(freed).toMatchObject({ usedAt: null, usedOnOrderId: null });

    const other = await createTestUser();
    await placeOrderWithOffer(shop.id, other.id, offer.id);
    await placeOrderWithOffer(shop.id, customer.id, offer.id).then(
      () => expect.fail("maxUses 1 is reached again"),
      (error: unknown) =>
        expect((error as DiscountUnavailableError).reason).toBe("OFFER_NOT_REDEEMABLE")
    );
    const reorder = await createTestOrder({ shopId: shop.id, userId: customer.id });
    await inTx((tx) =>
      consumeLoyaltyReward(tx, {
        rewardId: reward.id,
        userId: customer.id,
        orderId: reorder.id,
        now,
      })
    );
  });

  it("never drives currentUses below 0", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer({ currentUses: 0 });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      status: "CANCELLED",
      overrides: { offerId: offer.id },
    });

    await inTx((tx) => releaseOrderDiscount(tx, order));
    await inTx((tx) => releaseOrderDiscount(tx, order));

    expect(await offerUses(offer.id)).toBe(0);
  });

  it("does not free a reward used on another order", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const [first, second] = [
      await createTestOrder({ shopId: shop.id, userId: customer.id }),
      await createTestOrder({ shopId: shop.id, userId: customer.id }),
    ];
    const reward = await createReward(customer.id, {
      usedAt: new Date(),
      usedOnOrderId: second.id,
    });

    await inTx((tx) => releaseOrderDiscount(tx, { ...first, loyaltyRewardId: reward.id }));

    expect(await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).toEqual(
      reward
    );
  });

  it("changes nothing for an order that consumed nothing", async () => {
    const shop = await createTestShop();
    const customer = await createTestUser();
    const offer = await createTestOffer({ currentUses: 4 });
    const reward = await createReward(customer.id, {
      usedAt: new Date(),
      usedOnOrderId: "elsewhere",
    });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      status: "CANCELLED",
    });

    await inTx((tx) => releaseOrderDiscount(tx, order));

    expect(await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).toEqual(offer);
    expect(await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).toEqual(
      reward
    );
  });
});
