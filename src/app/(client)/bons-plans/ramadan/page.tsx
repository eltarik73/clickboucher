// src/app/(client)/bons-plans/ramadan/page.tsx — Ramadan seasonal offers
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Offres Ramadan — Boucherie Halal",
  description: "Offres spéciales Ramadan dans les boucheries halal. Préparez l'Iftar avec des produits de qualité à prix réduit. Commandez en click & collect et récupérez sans attendre.",
  alternates: { canonical: `${SITE_URL}/bons-plans/ramadan` },
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default async function RamadanPage() {
  const now = new Date();

  // Products tagged "ramadan" + active ramadan offers
  const [taggedProducts, ramadanOffers] = await Promise.all([
    prisma.product.findMany({
      where: {
        tags: { has: "ramadan" },
        inStock: true,
        isActive: true,
      },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        categories: { select: { id: true, name: true, emoji: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
      orderBy: { priceCents: "asc" },
    }),
    prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        name: { contains: "ramadan", mode: "insensitive" },
        startDate: { lte: now },
        endDate: { gt: now },
      },
      include: { shop: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (taggedProducts.length === 0 && ramadanOffers.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <span className="text-4xl mb-4 block">🌙</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ramadan</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Les offres speciales Ramadan apparaitront ici pendant le mois sacre</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-4">
      {/* Ramadan banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 text-center">
        <span className="text-3xl mb-2 block">🌙</span>
        <h2 className="text-white font-bold text-base">Ramadan Mubarak</h2>
        <p className="text-amber-400 text-xs mt-1">Preparez l&apos;Iftar avec nos meilleures offres</p>
      </div>

      {/* Platform Ramadan offers */}
      {ramadanOffers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider px-1">Offres Ramadan</p>
          {ramadanOffers.map((o) => (
            <Link key={o.id} href={o.shop?.slug ? `/boutique/${o.shop.slug}` : "/bons-plans/ramadan"}>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-amber-200/60 dark:border-amber-800/20">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{o.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{o.shop?.name || "Klik&Go"}</p>
                {o.code && (
                  <span className="inline-block mt-1 text-[10px] font-mono bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    {o.code}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tagged products */}
      {taggedProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider px-1">
            {taggedProducts.length} produit{taggedProducts.length > 1 ? "s" : ""} Ramadan
          </p>
          {taggedProducts.map((p) => {
            const imgSrc = p.images[0]?.url || resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.categories[0]?.name || "" });
            const discounted = p.promoPct ? Math.round(p.priceCents * (1 - p.promoPct / 100)) : null;
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
                <div className="flex gap-2.5 p-2.5 bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3]/60 dark:border-white/[0.06] transition-all hover:shadow-md">
                  <div className="relative w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
                    <Image src={imgSrc} alt={p.name} fill sizes="64px" className="object-cover" quality={70} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</h3>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[13px] font-extrabold text-[#1A1A1A] dark:text-white">
                        {fmtPrice(discounted ?? p.priceCents)}
                      </span>
                      {discounted && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 line-through">{fmtPrice(p.priceCents)}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">{p.shop.name}</span>
                  </div>
                </div>
              </BonsPlansProductCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
