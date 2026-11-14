// src/app/(client)/bons-plans/vente-flash/page.tsx — Flash sales
export const revalidate = 300;

import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { FlashCountdown } from "@/components/product/FlashCountdown";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { flashSaleListWhere } from "@/lib/bons-plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Ventes Flash Boucherie Halal",
  description:
    "Offres flash limitées dans les boucheries halal près de chez vous. Profitez rapidement des prix réduits sur la viande halal fraîche avant épuisement des stocks.",
  alternates: { canonical: `${SITE_URL}/bons-plans/vente-flash` },
  robots: { index: false, follow: true },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function VenteFlashPage() {
  const now = new Date();

  const products = await prisma.product.findMany({
    where: flashSaleListWhere(now),
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (products.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="mb-4 block text-4xl">⚡</span>
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Aucune vente flash</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Les ventes flash apparaitront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
        {products.length} offre{products.length > 1 ? "s" : ""} flash
      </p>
      {products.map((p) => {
        const imgSrc =
          p.images[0]?.url ||
          resolveProductImage({
            name: p.name,
            imageUrl: p.imageUrl,
            category: p.categories[0]?.name || "",
          });
        // The price charged (pricing module): a flash sale already rewrote priceCents.
        const price = resolveUnitPrice(p, { isPro: false, now });
        if (!price.ok)
          throw new Error(`resolveUnitPrice refused ${p.id} without a cut option: ${price.error}`);
        const endAt = p.flashSaleEndAt?.toISOString() || p.promoEnd?.toISOString() || null;
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
              isAntiGaspi: p.isAntiGaspi,
              antiGaspiStock: p.antiGaspiStock,
              isFlashSale: p.isFlashSale,
              flashSaleStock: p.flashSaleStock,
            }}
            shop={p.shop}
          >
            <div className="flex gap-2.5 rounded-2xl border border-orange-200/60 bg-white p-2.5 ring-1 ring-orange-300/30 transition-all hover:shadow-md dark:border-orange-800/20 dark:bg-gray-800 dark:ring-orange-700/30">
              <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                <Image
                  src={imgSrc}
                  alt={p.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                  quality={70}
                />
                <div className="absolute left-0 top-0 rounded-br-lg bg-gradient-to-r from-red-600 to-orange-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  ⚡ Flash
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {p.name}
                </h3>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold text-[#DC2626]">
                    {fmtPrice(price.unitPriceCents)}
                  </span>
                  {price.promo && (
                    <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                      {fmtPrice(price.baseCents)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {p.shop.name}
                  </span>
                  {endAt && <FlashCountdown promoEnd={endAt} />}
                </div>
              </div>
            </div>
          </BonsPlansProductCard>
        );
      })}
    </div>
  );
}
