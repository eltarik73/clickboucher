// @vitest-environment node
// Copie Redis de GET /api/products?shopId (visiteur, sans filtre), sur PostgreSQL réel (revue de la
// PR #28). Avant, la copie gardait la liste déjà « réglée » : un anti-gaspi qui se terminait pendant
// ses 60 s restait affiché au prix remisé alors que le devis facturait déjà le prix d'origine.
// Désormais la copie garde les lignes telles que lues et chaque lecture applique la fin de
// l'anti-gaspi à l'heure courante. Redis (Upstash, frontière réseau) est remplacé par un faux en
// mémoire, comme le client de src/lib/redis.ts qui ne lève jamais ; l'identité de l'appelant par
// le harnais d'authentification.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      // Upstash stores JSON: what comes back is the parsed JSON (dates as ISO strings).
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
    del: async (key: string) => {
      store.delete(key);
    },
  },
}));
vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("../images/product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("../images/product-routes-harness")).boucherAuthMock
);

import type { Product, Shop } from "@prisma/client";
import { session } from "../images/product-routes-harness";
import { useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";

const { GET: listProducts } = await import("@/app/api/products/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const MINUTE_MS = 60 * 1000;
const ORIGINAL = 2000;
const DISCOUNTED = 1000;

let shop: Shop;
let product: Product;

beforeEach(async () => {
  session.clerkId = null;
  session.userId = null;
  session.shopId = null;
  session.role = undefined;
  shop = await createTestShop();
  product = await createTestProduct(shop.id, {
    name: "Merguez anti-gaspi",
    unit: "PIECE",
    priceCents: DISCOUNTED,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: ORIGINAL,
    antiGaspiEndAt: new Date(Date.now() + MINUTE_MS),
    antiGaspiStock: 3,
  });
});

afterEach(() => {
  store.clear();
});

const key = () => `products:shop:${shop.id}`;

async function list(): Promise<Array<Record<string, unknown>>> {
  const response = await listProducts(
    new NextRequest(`http://localhost/api/products?shopId=${shop.id}`)
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Array<Record<string, unknown>> }).data;
}

describe("copie Redis de la liste publique des produits d'une boutique", () => {
  it("garde les lignes telles que lues : l'anti-gaspi en cours y figure", async () => {
    expect(await list()).toEqual([
      expect.objectContaining({ id: product.id, priceCents: DISCOUNTED, isAntiGaspi: true }),
    ]);

    expect(store.get(key())).toEqual([
      expect.objectContaining({ id: product.id, priceCents: DISCOUNTED, isAntiGaspi: true }),
    ]);
  });

  it("un anti-gaspi terminé depuis l'écriture de la copie est servi au prix d'origine", async () => {
    await list();
    // One minute later: the copy is still within its 60 s but the discount has ended.
    const cached = store.get(key()) as Array<Record<string, unknown>>;
    store.set(key(), [{ ...cached[0], antiGaspiEndAt: new Date(Date.now() - 1000).toISOString() }]);

    expect(await list()).toEqual([
      expect.objectContaining({
        id: product.id,
        priceCents: ORIGINAL,
        isAntiGaspi: false,
        antiGaspiStock: null,
      }),
    ]);
  });

  it("une entrée illisible est un raté : la liste est relue en base", async () => {
    store.set(key(), "pas une liste");

    expect(await list()).toEqual([expect.objectContaining({ id: product.id })]);
    expect(Array.isArray(store.get(key()))).toBe(true);
  });
});
