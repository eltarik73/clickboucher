// src/lib/bons-plans.ts — which products each « bons plans » list shows, and how many.
// One filter per list, read by its page and by the homepage carousel count, so the carousel never
// announces an offer whose page is empty. Every list keeps orderable products only: active, in
// stock and not sold out in a limited mode (src/lib/pricing/limited-stock.ts).
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { limitedStockOnSaleWhere } from "@/lib/pricing/limited-stock";

/** Active, in stock, not sold out in a limited mode, plus the list's own conditions. */
function orderable(...conditions: Prisma.ProductWhereInput[]): Prisma.ProductWhereInput {
  return { inStock: true, isActive: true, AND: [limitedStockOnSaleWhere, ...conditions] };
}

export function antiGaspiListWhere(now: Date): Prisma.ProductWhereInput {
  return orderable({
    isAntiGaspi: true,
    OR: [{ antiGaspiEndAt: null }, { antiGaspiEndAt: { gt: now } }],
  });
}

export function flashSaleListWhere(now: Date): Prisma.ProductWhereInput {
  return orderable({
    OR: [
      { isFlashSale: true, flashSaleEndAt: { gt: now } },
      { promoType: "FLASH", promoEnd: { gt: now } },
    ],
  });
}

/** Candidates only: the promotions page then keeps those the pricing module applies. */
export function promoListWhere(now: Date): Prisma.ProductWhereInput {
  return orderable(
    {
      OR: [
        { promoType: "PERCENTAGE", promoPct: { gt: 0 } },
        {
          promoType: "FIXED_AMOUNT",
          OR: [{ promoFixedCents: { gt: 0 } }, { promoPct: { gt: 0 } }],
        },
      ],
    },
    { OR: [{ promoEnd: null }, { promoEnd: { gt: now } }] }
  );
}

export const packListWhere = orderable({ packContent: { not: null } });

export interface BonsPlansCounts {
  antiGaspi: number;
  flashSale: number;
  promo: number;
  pack: number;
}

export async function countBonsPlans(now: Date): Promise<BonsPlansCounts> {
  const [antiGaspi, flashSale, promo, pack] = await Promise.all([
    prisma.product.count({ where: antiGaspiListWhere(now) }),
    prisma.product.count({ where: flashSaleListWhere(now) }),
    prisma.product.count({ where: promoListWhere(now) }),
    prisma.product.count({ where: packListWhere }),
  ]);
  return { antiGaspi, flashSale, promo, pack };
}
