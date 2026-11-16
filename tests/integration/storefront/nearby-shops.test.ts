// @vitest-environment node
// GET /api/shops/nearby, the home list sorted by distance: shop cards as every list page builds
// them (src/lib/seo/shop-cards.ts), with the verified rating only, never the seeded Shop.rating /
// ratingCount (4.7 / 89 on the demo shops). Handler called directly on real PostgreSQL; Redis is
// an in-memory map.
import type { Shop } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  },
}));

const { GET } = await import("@/app/api/shops/nearby/route");

// Not a React hook: the rule only looks at the « use » prefix of the name.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

beforeEach(() => {
  store.clear();
});

const CHAMBERY = { latitude: 45.5646, longitude: 5.9178 };

/** 0.009 degree of latitude is 1.0 km on the Haversine sphere (6371 km). */
function northOf(km: number) {
  return { latitude: CHAMBERY.latitude + km * 0.009, longitude: CHAMBERY.longitude };
}

type Card = { id: string; name: string; distance: number | null; verifiedRating: unknown };

async function nearby(): Promise<{ text: string; cards: Card[] }> {
  const query = `lat=${CHAMBERY.latitude}&lng=${CHAMBERY.longitude}&radius=15`;
  const res = await GET(new NextRequest(`http://localhost/api/shops/nearby?${query}`));
  expect(res.status).toBe(200);
  const text = await res.text();
  return { text, cards: JSON.parse(text).data };
}

/** A review tied to a collected order of its author in that shop: a verified review. */
async function addVerifiedReview(shop: Shop, rating: number): Promise<void> {
  const author = await createTestUser();
  const order = await createTestOrder({ shopId: shop.id, userId: author.id, status: "PICKED_UP" });
  await prisma.review.create({
    data: { shopId: shop.id, userId: author.id, orderId: order.id, rating },
  });
}

describe("GET /api/shops/nearby", () => {
  it("returns shop cards: verified rating only, no Shop.rating or ratingCount anywhere", async () => {
    const demo = await createTestShop({
      name: "Boucherie Démo",
      ...CHAMBERY,
      rating: 4.7,
      ratingCount: 89,
    });
    // A seeded review has no order: it never counts.
    await prisma.review.create({
      data: { shopId: demo.id, userId: (await createTestUser()).id, rating: 5 },
    });
    const reviewed = await createTestShop({
      name: "Boucherie Vérifiée",
      ...northOf(1),
      rating: 4.9,
      ratingCount: 120,
    });
    await addVerifiedReview(reviewed, 5);
    await addVerifiedReview(reviewed, 2);

    const { text, cards } = await nearby();

    expect(cards.map((card) => [card.name, card.verifiedRating])).toEqual([
      ["Boucherie Démo", null],
      ["Boucherie Vérifiée", { average: 3.5, count: 2 }],
    ]);
    expect(text).not.toMatch(/"rating(Count)?":/);
    expect(Object.keys(cards[0]).sort()).toEqual([
      "activePromo",
      "address",
      "busyExtraMin",
      "busyMode",
      "city",
      "distance",
      "id",
      "imageUrl",
      "latitude",
      "longitude",
      "name",
      "openingHours",
      "prepTimeMin",
      "slug",
      "status",
      "verifiedRating",
    ]);
  });

  it("orders by distance, then the shops without coordinates by name; hidden and distant shops are absent", async () => {
    await createTestShop({ name: "Boucherie Trois", ...northOf(3) });
    await createTestShop({ name: "Boucherie Une", ...northOf(1) });
    await createTestShop({ name: "Boucherie Deux", ...northOf(2) });
    await createTestShop({ name: "Boucherie Lointaine", ...northOf(22) });
    await createTestShop({ name: "Boucherie Masquée", ...CHAMBERY, visible: false });
    // Ranked by Shop.rating, these two would come out in the reverse order.
    await createTestShop({ name: "Boucherie Zeta", rating: 5, ratingCount: 200 });
    await createTestShop({ name: "Boucherie Alpha", rating: 1, ratingCount: 3 });
    await createTestShop({ name: "Boucherie Cachée", visible: false });

    const { cards } = await nearby();

    expect(cards.map((card) => [card.name, card.distance])).toEqual([
      ["Boucherie Une", 1],
      ["Boucherie Deux", 2],
      ["Boucherie Trois", 3],
      ["Boucherie Alpha", null],
      ["Boucherie Zeta", null],
    ]);
    // The raw distance query selects the columns the Prisma read of the others selects.
    expect(new Set(cards.map((card) => Object.keys(card).sort().join())).size).toBe(1);
  });

  it("caches its cards for the next request, and never serves an entry of the previous shape", async () => {
    const shop = await createTestShop({ ...CHAMBERY, rating: 4.7, ratingCount: 89 });
    const previousKey = `nearby:${CHAMBERY.latitude.toFixed(2)}:${CHAMBERY.longitude.toFixed(2)}:15`;
    store.set(previousKey, [{ id: shop.id, name: shop.name, rating: 4.7, ratingCount: 89 }]);

    const first = await nearby();
    await prisma.shop.update({ where: { id: shop.id }, data: { name: "Boucherie Renommée" } });
    const second = await nearby();

    expect(first.cards.map((card) => [card.id, card.verifiedRating])).toEqual([[shop.id, null]]);
    expect(first.text).not.toMatch(/"rating(Count)?":/);
    expect(second.text).toBe(first.text);
  });
});
