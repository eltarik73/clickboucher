// @vitest-environment node
//
// The ratings the visitor reads come from verified reviews only (C1-SEO, IND-2): the shop cards of
// the list pages (city, district, department, Sunday, product x city, occasion x city, home, store
// finder) and the review list of a shop page. The demo shops carry seeded Shop.rating /
// ratingCount figures (4.7 / 89) and reviews without any order: none of it may be printed, and the
// lists are no longer ranked by it. On real PostgreSQL.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderStatus, Shop, User } from "@prisma/client";
import { listVerifiedReviews, loadVerifiedRatings } from "@/lib/reviews/verified-rating";
import { shopCardOrderBy, shopCardSelect, toShopCards } from "@/lib/seo/shop-cards";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Not a React hook: the rule only looks at the « use » prefix of the name.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

/** A review tied to a new order of its author in that shop (verified once collected). */
async function addOrderReview(input: {
  shop: Shop;
  rating: number;
  user?: User;
  comment?: string | null;
  status?: OrderStatus;
  createdAt?: Date;
}): Promise<void> {
  const user = input.user ?? (await createTestUser());
  const order = await createTestOrder({
    shopId: input.shop.id,
    userId: user.id,
    status: input.status ?? "PICKED_UP",
  });
  await prisma.review.create({
    data: {
      shopId: input.shop.id,
      userId: user.id,
      orderId: order.id,
      rating: input.rating,
      comment: input.comment ?? null,
      ...(input.createdAt && { createdAt: input.createdAt }),
    },
  });
}

/** A seeded review: no order, as prisma/seed.ts writes them. */
async function addSeededReview(shop: Shop, rating: number, comment: string): Promise<void> {
  const user = await createTestUser();
  await prisma.review.create({ data: { shopId: shop.id, userId: user.id, rating, comment } });
}

/** The cards of the city page of Chambéry, with the query every list page runs. */
async function chamberyCards() {
  const rows = await prisma.shop.findMany({
    where: { visible: true, city: { contains: "Chambéry", mode: "insensitive" } },
    select: shopCardSelect,
    orderBy: shopCardOrderBy(),
  });
  return toShopCards(rows);
}

describe("shop cards of the list pages", () => {
  it("print no rating for a seeded 4.7/89 shop, and 3.5/2 for a shop with two verified reviews", async () => {
    const seeded = await createTestShop({ name: "Boucherie Démo", rating: 4.7, ratingCount: 89 });
    await addSeededReview(seeded, 5, "Le meilleur boucher du quartier.");
    await addOrderReview({ shop: seeded, rating: 1, status: "CANCELLED" });
    const reviewed = await createTestShop({
      name: "Boucherie Vérifiée",
      rating: 4.9,
      ratingCount: 120,
    });
    await addOrderReview({ shop: reviewed, rating: 5 });
    await addOrderReview({ shop: reviewed, rating: 2, status: "COMPLETED" });

    const cards = await chamberyCards();

    expect(cards.map((card) => [card.name, card.verifiedRating])).toEqual([
      ["Boucherie Démo", null],
      ["Boucherie Vérifiée", { average: 3.5, count: 2 }],
    ]);
    for (const card of cards) {
      expect(Object.keys(card)).not.toContain("rating");
      expect(Object.keys(card)).not.toContain("ratingCount");
    }
  });

  it("orders the shops by name, never by the seeded rating", async () => {
    await createTestShop({ name: "Charcuterie Zénith", rating: 5, ratingCount: 900 });
    await createTestShop({ name: "Abattoir Alpin", rating: 1, ratingCount: 3 });
    await createTestShop({ name: "Boucherie Centrale", rating: 4.8, ratingCount: 156 });

    expect((await chamberyCards()).map((card) => card.name)).toEqual([
      "Abattoir Alpin",
      "Boucherie Centrale",
      "Charcuterie Zénith",
    ]);
  });

  it("loads the ratings of the whole list in one query, and none for an empty list", async () => {
    const shops = await Promise.all([1, 2, 3, 4].map(() => createTestShop()));
    await addOrderReview({ shop: shops[0], rating: 4 });
    await addOrderReview({ shop: shops[2], rating: 5 });
    await addOrderReview({ shop: shops[2], rating: 3 });
    const rows = await prisma.shop.findMany({
      where: { id: { in: shops.map((shop) => shop.id) } },
      select: shopCardSelect,
    });
    const queries = vi.spyOn(prisma, "$queryRaw");

    const cards = await toShopCards(rows);

    expect(queries).toHaveBeenCalledTimes(1);
    expect(new Map(cards.map((card) => [card.id, card.verifiedRating]))).toEqual(
      new Map([
        [shops[0].id, { average: 4, count: 1 }],
        [shops[1].id, null],
        [shops[2].id, { average: 4, count: 2 }],
        [shops[3].id, null],
      ])
    );

    expect(await toShopCards([])).toEqual([]);
    expect(await loadVerifiedRatings([])).toEqual(new Map());
    expect(queries).toHaveBeenCalledTimes(1);
  });
});

describe("listVerifiedReviews", () => {
  it("lists the verified reviews only, newest first, with the author as « Amina K. »", async () => {
    const shop = await createTestShop({ rating: 4.7, ratingCount: 89 });
    await addSeededReview(shop, 5, "Excellente qualité, viande toujours fraîche !");
    await addOrderReview({ shop, rating: 1, status: "READY", comment: "Pas retirée." });
    await addOrderReview({
      shop,
      rating: 5,
      user: await createTestUser({ firstName: "amina", lastName: "kaci" }),
      comment: "  Accueil chaleureux.  ",
      createdAt: new Date("2026-10-01T09:00:00Z"),
    });
    await addOrderReview({
      shop,
      rating: 2,
      user: await createTestUser({ firstName: " ", lastName: "Martin" }),
      comment: "   ",
      createdAt: new Date("2026-10-03T09:00:00Z"),
    });

    const reviews = await listVerifiedReviews(shop.id);

    expect(reviews.map(({ id: _id, ...review }) => review)).toEqual([
      {
        rating: 2,
        comment: null,
        createdAt: "2026-10-03T09:00:00.000Z",
        user: { firstName: "Client", lastInitial: "" },
      },
      {
        rating: 5,
        comment: "Accueil chaleureux.",
        createdAt: "2026-10-01T09:00:00.000Z",
        user: { firstName: "Amina", lastInitial: "K." },
      },
    ]);
  });

  it("lists nothing for a shop whose reviews are all seeded", async () => {
    const shop = await createTestShop({ rating: 4.8, ratingCount: 156 });
    await addSeededReview(shop, 5, "Toujours satisfait.");

    expect(await listVerifiedReviews(shop.id)).toEqual([]);
  });
});
