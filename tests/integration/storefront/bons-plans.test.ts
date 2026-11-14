// @vitest-environment node
// Les listes « bons plans » et le compteur du carrousel de l'accueil ne montrent que des produits
// commandables : un produit anti-gaspi ou en vente flash dont le compteur est à 0 n'y figure plus,
// comme le devis le refuse (src/lib/pricing/limited-stock.ts). Sur PostgreSQL réel.
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { BonsPlansClient } from "@/app/(client)/bons-plans/BonsPlansClient";
import { AntiGaspiBanner } from "@/components/client/AntiGaspiBanner";
import { ShopProductsClient } from "@/components/shop/ShopProductsClient";
import { countBonsPlans } from "@/lib/bons-plans";
import { limitedStockOnSaleWhere, limitedStockSoldOut } from "@/lib/pricing/limited-stock";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";

// React.cache n'existe que sous la condition « react-server » de Next : hors Next, une identité.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const { default: AntiGaspiPage } = await import("@/app/(client)/bons-plans/anti-gaspi/page");
const { default: VenteFlashPage } = await import("@/app/(client)/bons-plans/vente-flash/page");
const { default: PromosPage } = await import("@/app/(client)/bons-plans/promos/page");
const { default: PacksPage } = await import("@/app/(client)/bons-plans/packs/page");
const { default: RamadanPage } = await import("@/app/(client)/bons-plans/ramadan/page");
const { default: BonsPlansPage } = await import("@/app/(client)/bons-plans/page");
const { default: BoutiquePage } = await import("@/app/(client)/boutique/[slug]/page");

const FUTURE = new Date(Date.now() + 24 * 3600 * 1000);

/** Every prop of every element of a server-rendered tree whose type is `component`. */
function propsOf<P>(node: ReactNode, component: unknown): P[] {
  if (Array.isArray(node)) return node.flatMap((child) => propsOf<P>(child, component));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === component ? [node.props as P] : [];
  return [...own, ...propsOf<P>(node.props.children, component)];
}

function cardIds(tree: ReactNode): string[] {
  return propsOf<{ product: { id: string } }>(tree, BonsPlansProductCard).map((p) => p.product.id);
}

describe("limitedStockOnSaleWhere", () => {
  it("garde en base exactement les produits que limitedStockSoldOut laisse en vente", async () => {
    const shop = await createTestShop();
    const rows: Prisma.ProductCreateManyInput[] = [];
    for (const isAntiGaspi of [false, true])
      for (const antiGaspiStock of [null, -1, 0, 3])
        for (const isFlashSale of [false, true])
          for (const flashSaleStock of [null, 0, 2])
            rows.push({
              shopId: shop.id,
              name: `AG ${isAntiGaspi}/${antiGaspiStock} FS ${isFlashSale}/${flashSaleStock}`,
              unit: "PIECE",
              priceCents: 500,
              isAntiGaspi,
              antiGaspiStock,
              isFlashSale,
              flashSaleStock,
            });
    await prisma.product.createMany({ data: rows });
    const all = await prisma.product.findMany({ where: { shopId: shop.id } });
    const onSale = await prisma.product.findMany({
      where: { shopId: shop.id, ...limitedStockOnSaleWhere },
    });

    const expected = all.filter((p) => !limitedStockSoldOut(p)).map((p) => p.name);
    expect(onSale.map((p) => p.name).sort()).toEqual(expected.sort());
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(all.length);
  });
});

describe("listes bons plans et carrousel de l'accueil", () => {
  async function seed() {
    const shop = await createTestShop();
    const common: Partial<Prisma.ProductUncheckedCreateInput> = {
      unit: "PIECE",
      priceCents: 500,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 800,
      isFlashSale: true,
      flashSaleEndAt: FUTURE,
      promoType: "PERCENTAGE",
      promoPct: 10,
      packContent: "4 merguez",
      tags: ["ramadan"],
    };
    const onSale = await createTestProduct(shop.id, {
      ...common,
      name: "En vente",
      antiGaspiStock: 3,
      flashSaleStock: 2,
    });
    await createTestProduct(shop.id, {
      ...common,
      name: "Anti-gaspi épuisé",
      antiGaspiStock: 0,
      flashSaleStock: 2,
    });
    await createTestProduct(shop.id, {
      ...common,
      name: "Vente flash épuisée",
      antiGaspiStock: 3,
      flashSaleStock: 0,
    });
    return onSale;
  }

  it("le carrousel compte un seul produit par liste, le seul encore commandable", async () => {
    await seed();
    expect(await countBonsPlans(new Date())).toEqual({
      antiGaspi: 1,
      flashSale: 1,
      promo: 1,
      pack: 1,
    });
  });

  it.each([
    ["/bons-plans/anti-gaspi", AntiGaspiPage],
    ["/bons-plans/vente-flash", VenteFlashPage],
    ["/bons-plans/promos", PromosPage],
    ["/bons-plans/packs", PacksPage],
    ["/bons-plans/ramadan", RamadanPage],
  ])("%s ne montre pas les produits épuisés", async (_path, page) => {
    const onSale = await seed();
    expect(cardIds(await page())).toEqual([onSale.id]);
  });

  it("/bons-plans ne montre pas les produits épuisés", async () => {
    const onSale = await seed();
    const [client] = propsOf<{ promos: { id: string }[] }>(await BonsPlansPage(), BonsPlansClient);
    expect(client.promos.map((p) => p.id)).toEqual([onSale.id]);
  });
});

describe("page boutique : compteurs de vente flash", () => {
  it("transmet la vente flash et son compteur aux produits et au bandeau anti-gaspi", async () => {
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 500,
      isAntiGaspi: true,
      antiGaspiStock: 3,
      isFlashSale: true,
      flashSaleStock: 0,
      flashSaleEndAt: FUTURE,
    });
    const tree = await BoutiquePage({ params: { slug: shop.slug } });
    const expected = { id: product.id, isFlashSale: true, flashSaleStock: 0 };

    const [catalogue] = propsOf<{ products: object[] }>(tree, ShopProductsClient);
    expect(catalogue.products).toEqual([expect.objectContaining(expected)]);
    const [banner] = propsOf<{ products: object[] }>(tree, AntiGaspiBanner);
    expect(banner.products).toEqual([expect.objectContaining(expected)]);
  });
});
