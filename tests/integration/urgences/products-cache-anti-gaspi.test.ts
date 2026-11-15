// @vitest-environment node
// Copie Redis de GET /api/products?shopId (visiteur, sans filtre), sur PostgreSQL réel. La copie
// garde les lignes telles que lues et chaque lecture applique la fin de l'anti-gaspi à l'heure
// courante : un anti-gaspi qui se termine pendant les 60 s de la copie est servi au prix d'origine,
// comme le devis le facture. Redis (Upstash, frontière réseau) est remplacé par un faux en mémoire,
// comme le client de src/lib/redis.ts qui ne lève jamais ; l'identité de l'appelant par le harnais
// d'authentification.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
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
import { readCachedProducts, writeCachedProducts } from "@/lib/cache/products-cache";
import { logger } from "@/lib/logger";
import { actAs, call, session } from "../images/product-routes-harness";
import { useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";

const { GET: listProducts } = await import("@/app/api/products/route");
const { PATCH: setActive } = await import("@/app/api/products/[id]/active/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const MINUTE_MS = 60 * 1000;
const ORIGINAL = 2000;
const DISCOUNTED = 1000;

let shop: Shop;
let product: Product;

function signOut(): void {
  session.clerkId = null;
  session.userId = null;
  session.shopId = null;
  session.role = undefined;
}

beforeEach(async () => {
  signOut();
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
  vi.restoreAllMocks();
});

async function list(): Promise<Array<Record<string, unknown>>> {
  const response = await listProducts(
    new NextRequest(`http://localhost/api/products?shopId=${shop.id}`)
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Array<Record<string, unknown>> }).data;
}

type CachedRow = { id: string; priceCents: number; antiGaspiEndAt: Date | null };

describe("copie Redis de la liste publique des produits d'une boutique", () => {
  it("garde les lignes telles que lues, dates comprises : l'anti-gaspi en cours y figure", async () => {
    expect(await list()).toEqual([
      expect.objectContaining({ id: product.id, priceCents: DISCOUNTED, isAntiGaspi: true }),
    ]);

    expect(await readCachedProducts<CachedRow>(shop.id)).toEqual([
      expect.objectContaining({
        id: product.id,
        priceCents: DISCOUNTED,
        isAntiGaspi: true,
        antiGaspiEndAt: product.antiGaspiEndAt,
      }),
    ]);
  });

  it("un anti-gaspi terminé depuis l'écriture de la copie est servi au prix d'origine", async () => {
    await list();
    // Une minute plus tard : la copie a encore moins de 60 s mais la remise est terminée.
    const cached = await readCachedProducts<CachedRow>(shop.id);
    if (cached === null) throw new Error("copie Redis absente après la première lecture");
    const ended: CachedRow = { ...cached[0], antiGaspiEndAt: new Date(Date.now() - 1000) };
    await writeCachedProducts(shop.id, [ended]);

    expect(await list()).toEqual([
      expect.objectContaining({
        id: product.id,
        priceCents: ORIGINAL,
        isAntiGaspi: false,
        antiGaspiStock: null,
      }),
    ]);
  });

  it.each([
    ["un texte illisible", "pas une liste"],
    ["une ligne sans id", JSON.stringify([{ name: "Merguez" }])],
  ])(
    "%s est un raté journalisé une fois : la liste est relue en base et la copie refaite",
    async (_label, entry) => {
      await list();
      for (const key of store.keys()) store.set(key, entry);
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

      expect(await list()).toEqual([expect.objectContaining({ id: product.id })]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(await readCachedProducts<CachedRow>(shop.id)).toEqual([
        expect.objectContaining({ id: product.id }),
      ]);
    }
  );

  it("activer ou désactiver un produit efface la copie", async () => {
    await list();
    expect(await readCachedProducts<CachedRow>(shop.id)).not.toBeNull();
    actAs(await createTestUser({ role: "BOUCHER" }), shop.id);

    const toggled = await call(
      setActive,
      `/api/products/${product.id}/active`,
      "PATCH",
      { isActive: false },
      product.id
    );

    expect(toggled.status).toBe(200);
    expect(await readCachedProducts<CachedRow>(shop.id)).toBeNull();
  });
});
