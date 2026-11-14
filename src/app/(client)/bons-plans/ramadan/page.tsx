// src/app/(client)/bons-plans/ramadan/page.tsx — Ramadan seasonal offers
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { resolveProductImage } from "@/lib/product-images";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { limitedStockOnSaleWhere } from "@/lib/pricing/limited-stock";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Offres Ramadan — Boucherie Halal",
  description:
    "Offres spéciales Ramadan dans les boucheries halal. Préparez l'Iftar avec des produits de qualité à prix réduit. Commandez en click & collect et récupérez sans attendre.",
  alternates: { canonical: `${SITE_URL}/bons-plans/ramadan` },
  robots: { index: false, follow: true },
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
        ...limitedStockOnSaleWhere,
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
      <div className="px-4 py-16 text-center">
        <span className="mb-4 block text-4xl">🌙</span>
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Ramadan</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Les offres speciales Ramadan apparaitront ici pendant le mois sacre
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3 py-2">
      {/* Ramadan banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-4 text-center">
        <span className="mb-2 block text-3xl">🌙</span>
        <h2 className="text-base font-bold text-white">Ramadan Mubarak</h2>
        <p className="mt-1 text-xs text-amber-400">
          Preparez l&apos;Iftar avec nos meilleures offres
        </p>
      </div>

      {/* Platform Ramadan offers */}
      {ramadanOffers.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
            Offres Ramadan
          </p>
          {ramadanOffers.map((o) => (
            <Link
              key={o.id}
              href={o.shop?.slug ? `/boutique/${o.shop.slug}` : "/bons-plans/ramadan"}
            >
              <div className="rounded-2xl border border-amber-200/60 bg-white p-3 dark:border-amber-800/20 dark:bg-gray-800">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{o.name}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {o.shop?.name || "Klik&Go"}
                </p>
                {o.code && (
                  <span className="mt-1 inline-block rounded bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
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
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
            {taggedProducts.length} produit{taggedProducts.length > 1 ? "s" : ""} Ramadan
          </p>
          {taggedProducts.map((p) => {
            const imgSrc =
              p.images[0]?.url ||
              resolveProductImage({
                name: p.name,
                imageUrl: p.imageUrl,
                category: p.categories[0]?.name || "",
              });
            const price = resolveUnitPrice(p, { isPro: false, now });
            if (!price.ok)
              throw new Error(
                `resolveUnitPrice refused ${p.id} without a cut option: ${price.error}`
              );
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                      {p.name}
                    </h3>
                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-[13px] font-extrabold text-[#1A1A1A] dark:text-white">
                        {fmtPrice(price.unitPriceCents)}
                      </span>
                      {price.promo && (
                        <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                          {fmtPrice(price.baseCents)}
                        </span>
                      )}
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
      )}
    </div>
  );
}
