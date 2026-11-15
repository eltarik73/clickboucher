// src/lib/services/shops/markup-reprice.ts — the online prices of a shop's products after its
// markup or rounding setting changes (PATCH /api/shops/[id]). The online price is computed from the
// boutique price (src/lib/services/stripe/commission.ts); the anti-gaspi rule
// (src/lib/pricing/anti-gaspi.ts) decides what happens to a product in anti-gaspi.
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  antiGaspiEndOnPriceWrite,
  antiGaspiExpired,
  antiGaspiPricingSelect,
  type AntiGaspiColumns,
} from "@/lib/pricing/anti-gaspi";
import {
  computeOnlinePriceCents,
  getEffectiveCommissionRate,
  type ShopTier,
} from "@/lib/services/stripe/commission";

export type RepricedProduct = AntiGaspiColumns & { id: string; boutiquePriceCents: number | null };

export interface ProductPriceWrite {
  id: string;
  data: Prisma.ProductUpdateInput;
}

export interface RepricedShop {
  id: string;
  tier: ShopTier;
  earlyAdopterUntil: Date | null;
  commissionMarkupPercent: number;
  priceRoundingEnabled: boolean;
}

/**
 * The writes that bring each product with a boutique price to `onlinePrice(boutiquePriceCents)`:
 * - a running anti-gaspi discount keeps the price the butcher set; the price it returns to at its
 *   end (antiGaspiOrigPriceCents) follows the new setting;
 * - an expired one ends in the same write as the new price (antiGaspiEndOnPriceWrite), as every
 *   writer of priceCents does, so that the new price is the one customers pay;
 * - any other product takes the new price.
 * Products already at their price are left out. Pure: `now` is a parameter.
 */
export function planMarkupReprice(
  products: readonly RepricedProduct[],
  onlinePrice: (boutiquePriceCents: number) => number,
  now: Date
): ProductPriceWrite[] {
  return products.flatMap((product): ProductPriceWrite[] => {
    if (product.boutiquePriceCents === null || product.boutiquePriceCents <= 0) return [];
    const price = onlinePrice(product.boutiquePriceCents);
    if (product.isAntiGaspi && !antiGaspiExpired(product, now)) {
      return product.antiGaspiOrigPriceCents === price
        ? []
        : [{ id: product.id, data: { antiGaspiOrigPriceCents: price } }];
    }
    const ending = antiGaspiEndOnPriceWrite(product, price, now);
    if (price === product.priceCents && Object.keys(ending).length === 0) return [];
    return [{ id: product.id, data: { priceCents: price, ...ending } }];
  });
}

/** Reprices every product of the shop that has a boutique price, in one transaction. */
export async function repriceShopProducts(shop: RepricedShop, now: Date): Promise<number> {
  const rate = getEffectiveCommissionRate({
    tier: shop.tier,
    earlyAdopterUntil: shop.earlyAdopterUntil,
  });
  const products = await prisma.product.findMany({
    where: { shopId: shop.id, boutiquePriceCents: { not: null, gt: 0 } },
    select: { id: true, boutiquePriceCents: true, priceCents: true, ...antiGaspiPricingSelect },
  });
  const writes = planMarkupReprice(
    products,
    (boutiquePriceCents) =>
      computeOnlinePriceCents(
        boutiquePriceCents,
        rate,
        shop.commissionMarkupPercent,
        shop.priceRoundingEnabled
      ),
    now
  );
  if (writes.length > 0) {
    await prisma.$transaction(
      writes.map((write) => prisma.product.update({ where: { id: write.id }, data: write.data }))
    );
  }
  return writes.length;
}
