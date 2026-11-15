// @vitest-environment node
//
// A shop rating is published only from verified reviews: a review counts when its order is its
// own (same customer, same shop) and was collected (PICKED_UP or COMPLETED). Shop.rating and
// Shop.ratingCount (seeded figures), reviews without an order, reviews tied to another shop's or
// another customer's order and reviews of an order that was never collected publish nothing.
// A regression here would print invented stars in Google results. On real PostgreSQL.
import { describe, expect, it } from "vitest";
import type { OrderStatus, Shop, User } from "@prisma/client";
import { loadVerifiedShopRating } from "@/lib/reviews/verified-rating";
import { buildShopJsonLd } from "@/lib/seo/jsonld/shop";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Not a React hook: the rule only looks at the « use » prefix of the name.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

async function addReview(input: {
  shop: Shop;
  user: User;
  rating: number;
  comment?: string | null;
  orderId?: string | null;
  createdAt?: Date;
}): Promise<void> {
  await prisma.review.create({
    data: {
      shopId: input.shop.id,
      userId: input.user.id,
      rating: input.rating,
      comment: input.comment ?? null,
      orderId: input.orderId ?? null,
      ...(input.createdAt && { createdAt: input.createdAt }),
    },
  });
}

/** A review of `user` on `shop`, tied to a new order of `orderShop` (default: the same shop). */
async function addOrderReview(input: {
  shop: Shop;
  user: User;
  rating: number;
  status: OrderStatus;
  comment?: string | null;
  orderShop?: Shop;
  orderUser?: User;
  createdAt?: Date;
}): Promise<void> {
  const order = await createTestOrder({
    shopId: (input.orderShop ?? input.shop).id,
    userId: (input.orderUser ?? input.user).id,
    status: input.status,
  });
  await addReview({ ...input, orderId: order.id });
}

async function publishedJsonLd(shop: Shop): Promise<string> {
  const rating = await loadVerifiedShopRating(shop.id);
  const json = serializeJsonLd(buildShopJsonLd(shop, rating));
  if (json === null) throw new Error("The shop JSON-LD did not serialize");
  return json;
}

describe("loadVerifiedShopRating", () => {
  it("ignores the seeded Shop.rating and ratingCount when the shop has no review", async () => {
    const shop = await createTestShop({ rating: 4.7, ratingCount: 89 });

    expect(await loadVerifiedShopRating(shop.id)).toBeNull();
    const json = await publishedJsonLd(shop);
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain('"review"');
  });

  it("does not count reviews written without an order", async () => {
    const shop = await createTestShop({ rating: 4.5, ratingCount: 2 });
    await addReview({ shop, user: await createTestUser(), rating: 5, comment: "Parfait." });
    await addReview({ shop, user: await createTestUser(), rating: 4, comment: "Très bien." });

    expect(await loadVerifiedShopRating(shop.id)).toBeNull();
    expect(await publishedJsonLd(shop)).not.toContain("aggregateRating");
  });

  it("counts the reviews of collected orders of the same customer and shop, with the exact average", async () => {
    const shop = await createTestShop({ rating: 4.9, ratingCount: 120 });
    await addOrderReview({
      shop,
      user: await createTestUser({ firstName: "amina", lastName: "kaci" }),
      rating: 5,
      status: "PICKED_UP",
      comment: "  Accueil chaleureux.  ",
      createdAt: new Date("2026-10-01T09:00:00Z"),
    });
    await addOrderReview({
      shop,
      user: await createTestUser({ firstName: " ", lastName: "Martin" }),
      rating: 2,
      status: "PICKED_UP",
      comment: "Attente au retrait.",
      createdAt: new Date("2026-10-03T09:00:00Z"),
    });

    const rating = await loadVerifiedShopRating(shop.id);
    expect(rating).toEqual({
      average: 3.5,
      count: 2,
      reviews: [
        {
          rating: 2,
          comment: "Attente au retrait.",
          authorName: "Client",
          createdAt: new Date("2026-10-03T09:00:00Z"),
        },
        {
          rating: 5,
          comment: "Accueil chaleureux.",
          authorName: "Amina K.",
          createdAt: new Date("2026-10-01T09:00:00Z"),
        },
      ],
    });

    const json = await publishedJsonLd(shop);
    expect(JSON.parse(json)).toMatchObject({
      aggregateRating: { ratingValue: 3.5, reviewCount: 2, bestRating: 5, worstRating: 1 },
    });
    expect(JSON.parse(json).review).toHaveLength(2);
  });

  it("does not count a review tied to another shop's order, another customer's order or an uncollected order", async () => {
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    const customer = await createTestUser();
    await addOrderReview({
      shop,
      user: customer,
      rating: 1,
      status: "PICKED_UP",
      orderShop: otherShop,
    });
    await addOrderReview({
      shop,
      user: await createTestUser(),
      rating: 1,
      status: "COMPLETED",
      orderUser: customer,
    });
    const notCollected: OrderStatus[] = [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "DENIED",
      "CANCELLED",
      "PARTIALLY_DENIED",
      "AUTO_CANCELLED",
    ];
    for (const status of notCollected) {
      await addOrderReview({ shop, user: await createTestUser(), rating: 1, status });
    }

    expect(await loadVerifiedShopRating(shop.id)).toBeNull();
    expect(await publishedJsonLd(shop)).not.toContain("aggregateRating");

    await addOrderReview({ shop, user: customer, rating: 4, status: "COMPLETED" });
    expect(await loadVerifiedShopRating(shop.id)).toEqual({ average: 4, count: 1, reviews: [] });
  });

  it("publishes the two newest verified reviews with a text, while counting every verified review", async () => {
    const shop = await createTestShop();
    const day = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T12:00:00Z`);
    const reviews: { rating: number; comment: string | null; createdAt: Date }[] = [
      { rating: 5, comment: "Le plus ancien.", createdAt: day(1) },
      { rating: 4, comment: "Deuxième.", createdAt: day(2) },
      { rating: 3, comment: "Troisième.", createdAt: day(3) },
      { rating: 5, comment: "   ", createdAt: day(4) },
      { rating: 3, comment: null, createdAt: day(5) },
    ];
    for (const review of reviews) {
      await addOrderReview({ shop, user: await createTestUser(), status: "PICKED_UP", ...review });
    }
    await addReview({ shop, user: await createTestUser(), rating: 1, comment: "Sans commande." });

    const rating = await loadVerifiedShopRating(shop.id);
    expect(rating?.count).toBe(5);
    expect(rating?.average).toBeCloseTo(4, 10);
    expect(rating?.reviews.map((review) => review.comment)).toEqual(["Troisième.", "Deuxième."]);
  });

  it("keeps each shop's rating to its own reviews", async () => {
    const shop = await createTestShop();
    const otherShop = await createTestShop();
    await addOrderReview({
      shop: otherShop,
      user: await createTestUser(),
      rating: 5,
      status: "PICKED_UP",
    });

    expect(await loadVerifiedShopRating(shop.id)).toBeNull();
    expect(await loadVerifiedShopRating(otherShop.id)).toMatchObject({ average: 5, count: 1 });
  });
});
