// src/app/(client)/bons-plans/packs/page.tsx — Pack deals
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Packs Boucherie Halal",
  description: "Packs famille et lots a prix reduit dans les boucheries halal pres de chez vous.",
  alternates: { canonical: `${SITE_URL}/bons-plans/packs` },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function PacksPage() {
  const products = await prisma.product.findMany({
    where: {
      packContent: { not: null },
      inStock: true,
      isActive: true,
    },
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      categories: { select: { id: true, name: true, emoji: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    orderBy: { priceCents: "asc" },
  });

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <span className="text-4xl mb-4 block">📦</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucun pack disponible</h2>
        <p className="text-sm text-gray-500">Les packs apparaitront ici</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      <p className="text-xs text-gray-500 px-1">{products.length} pack{products.length > 1 ? "s" : ""}</p>
      {products.map((p) => {
        const imgSrc = p.images[0]?.url || resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.categories[0]?.name || "" });
        return (
          <Link key={p.id} href={`/boutique/${p.shop.slug}`}>
            <div className="flex gap-2.5 p-2.5 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3]/60 dark:border-white/[0.06] transition-all hover:shadow-md">
              <div className="relative w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
                <Image src={imgSrc} alt={p.name} fill sizes="64px" className="object-cover" quality={70} />
                <div className="absolute top-0 left-0 px-1.5 py-0.5 text-white text-[9px] font-extrabold rounded-br-lg bg-purple-600">
                  Pack
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{p.packContent}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-[13px] font-extrabold text-[#1A1A1A] dark:text-white">{fmtPrice(p.priceCents)}</span>
                  {p.packOldPriceCents && (
                    <span className="text-[9px] text-gray-400 line-through">{fmtPrice(p.packOldPriceCents)}</span>
                  )}
                  {p.packWeight && (
                    <span className="text-[9px] text-gray-400">{p.packWeight}</span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">{p.shop.name}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
