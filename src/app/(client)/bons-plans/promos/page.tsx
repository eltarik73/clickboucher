// src/app/(client)/bons-plans/promos/page.tsx — Standard product promos
export const revalidate = 60;

import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Promotions Boucherie Halal",
  description: "Toutes les promotions en cours dans les boucheries halal pres de chez vous.",
  alternates: { canonical: `${SITE_URL}/bons-plans/promos` },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function PromosPage() {
  const products = await prisma.product.findMany({
    where: {
      promoPct: { gt: 0 },
      promoType: { in: ["PERCENTAGE", "FIXED_AMOUNT"] },
      inStock: true,
      isActive: true,
      OR: [{ promoEnd: null }, { promoEnd: { gt: new Date() } }],
    },
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: { promoPct: "desc" },
  });

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <span className="text-4xl mb-4 block">🏷️</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucune promotion</h2>
        <p className="text-sm text-gray-500">Les promotions apparaitront ici</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <p className="text-xs text-gray-500 px-1">{products.length} promotion{products.length > 1 ? "s" : ""}</p>
      {products.map((p) => {
        const imgSrc = p.images[0]?.url || resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.categories[0]?.name || "" });
        const discounted = Math.round(p.priceCents * (1 - (p.promoPct || 0) / 100));
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
            }}
            shop={p.shop}
          >
            <div className="flex gap-2.5 p-2.5 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3]/60 dark:border-white/[0.06] transition-all hover:shadow-md">
              <div className="relative w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
                <Image src={imgSrc} alt={p.name} fill sizes="64px" className="object-cover" quality={70} />
                <div className="absolute top-0 left-0 px-1.5 py-0.5 text-white text-[9px] font-extrabold rounded-br-lg bg-[#EF4444]">
                  -{p.promoPct}%
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</h3>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-[13px] font-extrabold text-[#DC2626]">{fmtPrice(discounted)}</span>
                  <span className="text-[9px] text-gray-400 line-through">{fmtPrice(p.priceCents)}</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">{p.shop.name}</span>
              </div>
            </div>
          </BonsPlansProductCard>
        );
      })}
    </div>
  );
}
