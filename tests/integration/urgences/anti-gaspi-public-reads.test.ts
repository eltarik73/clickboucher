// @vitest-environment node
// Item 4 (C1-URGENCES), côté client, sur PostgreSQL réel : passé antiGaspiEndAt, chaque lecture
// publique montre le produit comme le devis le facture, au prix d'origine, hors anti-gaspi, et son
// compteur anti-gaspi à 0 ne le cache plus ni ne le dit « Épuisé ». Lectures couvertes : recherche,
// suggestions du panier, produits d'une boutique (public et pro), fiche produit, listes et compteurs
// des bons plans.
//
// Simulés : les helpers d'auth (identité de l'appelant), seule doublure permise ici.
import { isValidElement, type ReactNode } from "react";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("../images/product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("../images/product-routes-harness")).boucherAuthMock
);
// React.cache n'existe que sous la condition « react-server » de Next : hors Next, une identité.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import type { Product, Shop } from "@prisma/client";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { BonsPlansClient } from "@/app/(client)/bons-plans/BonsPlansClient";
import { countBonsPlans } from "@/lib/bons-plans";
import { settleAntiGaspi } from "@/lib/pricing/anti-gaspi";
import { limitedStockOnSaleWhere, limitedStockSoldOut } from "@/lib/pricing/limited-stock";
import { actAs, session } from "../images/product-routes-harness";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";

const { GET: search } = await import("@/app/api/search/route");
const { GET: suggestions } = await import("@/app/api/suggestions/route");
const { GET: listProducts } = await import("@/app/api/products/route");
const { GET: getProduct } = await import("@/app/api/products/[id]/route");
const { default: AntiGaspiPage } = await import("@/app/(client)/bons-plans/anti-gaspi/page");
const { default: VenteFlashPage } = await import("@/app/(client)/bons-plans/vente-flash/page");
const { default: PromosPage } = await import("@/app/(client)/bons-plans/promos/page");
const { default: PacksPage } = await import("@/app/(client)/bons-plans/packs/page");
const { default: RamadanPage } = await import("@/app/(client)/bons-plans/ramadan/page");
const { default: BonsPlansPage } = await import("@/app/(client)/bons-plans/page");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGINAL = 2000;

/** What every public reader must show for the expired product. */
const AS_QUOTED = { priceCents: ORIGINAL, isAntiGaspi: false, antiGaspiStock: null };

let shop: Shop;
let product: Product;

beforeEach(async () => {
  session.clerkId = null;
  session.userId = null;
  session.shopId = null;
  session.role = undefined;
  shop = await createTestShop();
  // Anti-gaspi ended yesterday at 1000 (original 2000) with its counter at 0; also in every
  // « bons plans » list: flash sale in force, 10 % promotion, pack, Ramadan tag.
  product = await createTestProduct(shop.id, {
    name: "Merguez maison",
    unit: "PIECE",
    priceCents: 1000,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: ORIGINAL,
    antiGaspiEndAt: new Date(Date.now() - DAY_MS),
    antiGaspiStock: 0,
    antiGaspiReason: "DLC proche",
    popular: true,
    isFlashSale: true,
    flashSaleStock: 2,
    flashSaleEndAt: new Date(Date.now() + DAY_MS),
    promoType: "PERCENTAGE",
    promoPct: 10,
    packContent: "6 merguez",
    tags: ["ramadan"],
  });
});

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

async function dataOf<T>(response: Response): Promise<T> {
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: T }).data;
}

/** Every prop of every element of a server-rendered tree whose type is `component`. */
function propsOf<P>(node: ReactNode, component: unknown): P[] {
  if (Array.isArray(node)) return node.flatMap((child) => propsOf<P>(child, component));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === component ? [node.props as P] : [];
  return [...own, ...propsOf<P>(node.props.children, component)];
}

describe("API publiques : le produit échu au prix d'origine, hors anti-gaspi", () => {
  it("GET /api/search : 2000 (« 20.00 »)", async () => {
    const data = await dataOf<{ results: object[] }>(
      await search(request("/api/search?q=merguez"))
    );

    expect(data.results).toEqual([
      expect.objectContaining({ id: product.id, price: "20.00", ...AS_QUOTED }),
    ]);
  });

  it("GET /api/suggestions : 2000", async () => {
    const data = await dataOf<object[]>(
      await suggestions(request(`/api/suggestions?shopId=${shop.id}`))
    );

    expect(data).toEqual([expect.objectContaining({ id: product.id, priceCents: ORIGINAL })]);
  });

  it("GET /api/products?shopId (visiteur) : 2000", async () => {
    const data = await dataOf<object[]>(
      await listProducts(request(`/api/products?shopId=${shop.id}`))
    );

    expect(data).toEqual([expect.objectContaining({ id: product.id, ...AS_QUOTED })]);
  });

  it("GET /api/products?shopId (client pro) : 2000", async () => {
    actAs(await createTestUser({ role: "CLIENT_PRO" }), null);

    const data = await dataOf<object[]>(
      await listProducts(request(`/api/products?shopId=${shop.id}`))
    );

    expect(data).toEqual([expect.objectContaining({ id: product.id, ...AS_QUOTED })]);
  });

  it("GET /api/products/[id] (visiteur) : 2000", async () => {
    const data = await dataOf<object>(
      await getProduct(request(`/api/products/${product.id}`), { params: { id: product.id } })
    );

    expect(data).toMatchObject({ id: product.id, ...AS_QUOTED });
  });
});

describe("bons plans : le produit échu est listé au prix d'origine, jamais caché ni « Épuisé »", () => {
  type Card = { product: { id: string; priceCents: number; isAntiGaspi?: boolean } };

  it.each([
    ["/bons-plans/vente-flash", VenteFlashPage],
    ["/bons-plans/promos", PromosPage],
    ["/bons-plans/packs", PacksPage],
    ["/bons-plans/ramadan", RamadanPage],
  ])("%s", async (_path, page) => {
    const cards = propsOf<Card>(await page(), BonsPlansProductCard);

    expect(cards.map((card) => card.product)).toEqual([
      expect.objectContaining({ id: product.id, priceCents: ORIGINAL }),
    ]);
    expect(cards[0].product.isAntiGaspi).not.toBe(true);
  });

  it("/bons-plans", async () => {
    const [client] = propsOf<{ promos: object[] }>(await BonsPlansPage(), BonsPlansClient);

    expect(client.promos).toEqual([
      expect.objectContaining({ id: product.id, priceCents: ORIGINAL }),
    ]);
  });

  it("/bons-plans/anti-gaspi ne le liste plus", async () => {
    expect(propsOf<Card>(await AntiGaspiPage(), BonsPlansProductCard)).toEqual([]);
  });

  it("le carrousel de l'accueil le compte partout sauf en anti-gaspi", async () => {
    expect(await countBonsPlans(new Date())).toEqual({
      antiGaspi: 0,
      flashSale: 1,
      promo: 1,
      pack: 1,
    });
  });
});

describe("limitedStockOnSaleWhere(now)", () => {
  it("garde en base exactement les produits que le storefront laisse en vente à `now`", async () => {
    const now = new Date();
    const ends = {
      aucune: null,
      hier: new Date(now.getTime() - DAY_MS),
      demain: new Date(now.getTime() + DAY_MS),
    };
    const rows = [];
    for (const [end, antiGaspiEndAt] of Object.entries(ends))
      for (const antiGaspiStock of [null, 0, 3])
        for (const flashSaleStock of [null, 0])
          rows.push({
            shopId: shop.id,
            name: `AG fin ${end} / ${antiGaspiStock} FS ${flashSaleStock}`,
            unit: "PIECE" as const,
            priceCents: 500,
            isAntiGaspi: true,
            antiGaspiOrigPriceCents: 800,
            antiGaspiEndAt,
            antiGaspiStock,
            isFlashSale: true,
            flashSaleStock,
          });
    await prisma.product.createMany({ data: rows });
    const where = { shopId: shop.id, id: { not: product.id } };
    const all = await prisma.product.findMany({ where });

    const onSale = await prisma.product.findMany({
      where: { ...where, ...limitedStockOnSaleWhere(now) },
    });

    const expected = all.filter((p) => !limitedStockSoldOut(settleAntiGaspi(p, now)));
    expect(onSale.map((p) => p.name).sort()).toEqual(expected.map((p) => p.name).sort());
    // The counter of an ended anti-gaspi no longer counts; a running one at 0 still sells out.
    expect(onSale.map((p) => p.name)).toContain("AG fin hier / 0 FS null");
    expect(onSale.map((p) => p.name)).not.toContain("AG fin demain / 0 FS null");
    expect(onSale.map((p) => p.name)).not.toContain("AG fin aucune / 0 FS null");
    expect(onSale.map((p) => p.name)).not.toContain("AG fin hier / 3 FS 0");
  });
});
