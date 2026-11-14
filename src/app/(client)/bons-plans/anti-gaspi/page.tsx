// src/app/(client)/bons-plans/anti-gaspi/page.tsx — Anti-gaspi products listing
export const revalidate = 300;

import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { limitedStockLowCount } from "@/lib/pricing/limited-stock";
import { antiGaspiListWhere } from "@/lib/bons-plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Anti-Gaspi — Produits à prix réduit",
  description:
    "Produits anti-gaspi des boucheries halal près de chez vous. Prix réduits sur les produits en fin de journée ou proches DLC. Achetez malin et réduisez le gaspillage.",
  alternates: { canonical: `${SITE_URL}/bons-plans/anti-gaspi` },
  robots: { index: false, follow: true },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function AntiGaspiPage() {
  const products = await prisma.product.findMany({
    where: antiGaspiListWhere(new Date()),
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: [{ antiGaspiEndAt: "asc" }, { priceCents: "asc" }],
  });

  if (products.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="mb-4 block text-4xl">🌿</span>
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
          Aucun produit anti-gaspi
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Les offres anti-gaspi apparaitront ici des qu&apos;un boucher en lancera
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
        {products.length} produit{products.length > 1 ? "s" : ""} a prix reduit
      </p>
      {products.map((p) => {
        const imgSrc =
          p.images[0]?.url ||
          resolveProductImage({
            name: p.name,
            imageUrl: p.imageUrl,
            category: p.categories[0]?.name || "",
          });
        const lowStock = limitedStockLowCount(p);
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
              isFlashSale: p.isFlashSale,
              flashSaleStock: p.flashSaleStock,
            }}
            shop={p.shop}
          >
            <div className="flex gap-2.5 rounded-2xl border border-emerald-200/60 bg-white p-2.5 ring-1 ring-emerald-300/30 transition-all hover:shadow-md dark:border-emerald-800/20 dark:bg-gray-800 dark:ring-emerald-700/30">
              <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                <Image
                  src={imgSrc}
                  alt={p.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                  quality={70}
                />
                <div className="absolute left-0 top-0 rounded-br-lg bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  Anti-Gaspi
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {p.name}
                </h3>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold text-emerald-600">
                    {fmtPrice(p.priceCents)}
                  </span>
                  {p.antiGaspiOrigPriceCents && (
                    <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                      {fmtPrice(p.antiGaspiOrigPriceCents)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {p.shop.name}
                  </span>
                  {lowStock !== null && (
                    <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                      Plus que {lowStock} !
                    </span>
                  )}
                  {p.antiGaspiReason && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {p.antiGaspiReason
                        .replace(/_/g, " ")
                        .toLowerCase()
                        .replace(/^\w/, (c) => c.toUpperCase())}
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
