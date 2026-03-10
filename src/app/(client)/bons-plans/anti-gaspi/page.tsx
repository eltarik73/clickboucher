// src/app/(client)/bons-plans/anti-gaspi/page.tsx — Anti-gaspi products listing
export const revalidate = 60;

import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Anti-Gaspi — Produits a prix reduit",
  description: "Produits anti-gaspi des boucheries halal pres de chez vous. Prix reduits sur les produits en fin de journee ou proches DLC.",
  alternates: { canonical: `${SITE_URL}/bons-plans/anti-gaspi` },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function AntiGaspiPage() {
  const products = await prisma.product.findMany({
    where: {
      isAntiGaspi: true,
      inStock: true,
      isActive: true,
      OR: [
        { antiGaspiEndAt: null },
        { antiGaspiEndAt: { gt: new Date() } },
      ],
    },
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: [{ antiGaspiEndAt: "asc" }, { priceCents: "asc" }],
  });

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <span className="text-4xl mb-4 block">🌿</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucun produit anti-gaspi</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Les offres anti-gaspi apparaitront ici des qu&apos;un boucher en lancera</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{products.length} produit{products.length > 1 ? "s" : ""} a prix reduit</p>
      {products.map((p) => {
        const imgSrc = p.images[0]?.url || resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.categories[0]?.name || "" });
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
              isAntiGaspi: true,
              antiGaspiOrigPriceCents: p.antiGaspiOrigPriceCents,
              antiGaspiStock: p.antiGaspiStock,
            }}
            shop={p.shop}
          >
            <div className="flex gap-2.5 p-2.5 bg-white dark:bg-white/[0.03] rounded-2xl border border-emerald-200/60 dark:border-emerald-800/20 ring-1 ring-emerald-300/30 dark:ring-emerald-700/30 transition-all hover:shadow-md">
              <div className="relative w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
                <Image src={imgSrc} alt={p.name} fill sizes="64px" className="object-cover" quality={70} />
                <div className="absolute top-0 left-0 px-1.5 py-0.5 text-white text-[9px] font-extrabold rounded-br-lg bg-emerald-600">
                  Anti-Gaspi
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</h3>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-[13px] font-extrabold text-emerald-600">{fmtPrice(p.priceCents)}</span>
                  {p.antiGaspiOrigPriceCents && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 line-through">{fmtPrice(p.antiGaspiOrigPriceCents)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.shop.name}</span>
                  {p.antiGaspiStock !== null && p.antiGaspiStock <= 5 && (
                    <span className="text-[9px] font-semibold text-orange-600">Plus que {p.antiGaspiStock} !</span>
                  )}
                  {p.antiGaspiReason && (
                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                      {p.antiGaspiReason.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </BonsPlansProductCard>
        );
      })}
    </div>
  );
}
