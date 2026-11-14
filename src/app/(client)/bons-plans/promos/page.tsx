// src/app/(client)/bons-plans/promos/page.tsx — Standard product promos
export const revalidate = 300;

import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { promoBadgeLabel } from "@/lib/pricing/display";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { promoListWhere } from "@/lib/bons-plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Promotions Boucherie Halal",
  description:
    "Découvrez toutes les promotions en cours dans les boucheries halal près de chez vous. Profitez des meilleures réductions sur la viande halal fraîche en click & collect.",
  alternates: { canonical: `${SITE_URL}/bons-plans/promos` },
  robots: { index: false, follow: true },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function PromosPage() {
  const now = new Date();
  const candidates = await prisma.product.findMany({
    where: promoListWhere(now),
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: { promoPct: "desc" },
  });
  // The price charged for each product (pricing module); only products whose promotion it applies.
  const products = candidates.flatMap((product) => {
    const price = resolveUnitPrice(product, { isPro: false, now });
    return price.ok && price.promo !== null
      ? [{ ...product, price: { ...price, promo: price.promo } }]
      : [];
  });

  if (products.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="mb-4 block text-4xl">🏷️</span>
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Aucune promotion</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Les promotions apparaitront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
        {products.length} promotion{products.length > 1 ? "s" : ""}
      </p>
      {products.map((p) => {
        const imgSrc =
          p.images[0]?.url ||
          resolveProductImage({
            name: p.name,
            imageUrl: p.imageUrl,
            category: p.categories[0]?.name || "",
          });
        return (
          <BonsPlansProductCard
            key={p.id}
            product={{
              id: p.id,
              name: p.name,
              imageUrl: imgSrc,
              priceCents: p.priceCents,
              unit: p.unit,
              category: p.categories[0]?.name || "",
              categoryEmoji: p.categories[0]?.emoji || undefined,
              promoPct: p.promoPct,
              promoType: p.promoType,
              promoFixedCents: p.promoFixedCents,
              promoEnd: p.promoEnd?.toISOString() ?? null,
            }}
            shop={p.shop}
          >
            <div className="flex gap-2.5 rounded-2xl border border-[#ece8e3]/60 bg-white p-2.5 transition-all hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800">
              <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                <Image
                  src={imgSrc}
                  alt={p.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                  quality={70}
                />
                <div className="absolute left-0 top-0 rounded-br-lg bg-[#EF4444] px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  {promoBadgeLabel(p.price.promo)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {p.name}
                </h3>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold text-[#DC2626]">
                    {fmtPrice(p.price.unitPriceCents)}
                  </span>
                  <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                    {fmtPrice(p.price.baseCents)}
                  </span>
                </div>
                <span className="mt-1 block text-[10px] text-gray-500 dark:text-gray-400">
                  {p.shop.name}
                </span>
              </div>
            </div>
          </BonsPlansProductCard>
        );
      })}
    </div>
  );
}
