// src/app/(client)/bons-plans/BonsPlansClient.tsx — Client-side promo listing
"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, ArrowLeft, MapPin } from "lucide-react";
import { FlashCountdown } from "@/components/product/FlashCountdown";
import { getProductImage } from "@/lib/product-images";
import { getFlag } from "@/lib/flags";

// ── Types ──
type PromoProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  promoPct: number;
  promoEnd: string | null;
  promoType: string | null;
  origin: string | null;
  halalOrg: string | null;
  category: { id: string; name: string; emoji: string | null };
  shop: { id: string; name: string; slug: string };
  images: { url: string; isPrimary: boolean }[];
};

type CategoryInfo = { id: string; name: string; emoji: string | null };

interface Props {
  promos: PromoProduct[];
  categories: CategoryInfo[];
}

// ── Helpers ──
function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pce" : "/barq.";
}

// ── Component ──
export function BonsPlansClient({ promos, categories }: Props) {
  const [activeCat, setActiveCat] = useState("Tout");

  const filtered = activeCat === "Tout"
    ? promos
    : promos.filter((p) => p.category.id === activeCat);

  // Separate flash from standard
  const flashPromos = filtered.filter((p) => p.promoType === "FLASH" && p.promoEnd);
  const standardPromos = filtered.filter((p) => p.promoType !== "FLASH" || !p.promoEnd);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] px-5 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/decouvrir"
              className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft size={16} className="text-white" />
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Flame size={22} /> Bons plans
            </h1>
          </div>
          <p className="text-white/80 text-sm">
            {promos.length} promo{promos.length > 1 ? "s" : ""} active{promos.length > 1 ? "s" : ""}
            {flashPromos.length > 0 && (
              <span className="ml-1">dont {flashPromos.length} flash</span>
            )}
          </p>
        </div>

        {/* Category pills */}
        <div className="sticky top-0 z-20 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl px-5 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCat("Tout")}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCat === "Tout"
                  ? "bg-[#DC2626] text-white"
                  : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
              }`}
            >
              Tout ({promos.length})
            </button>
            {categories.map((cat) => {
              const count = promos.filter((p) => p.category.id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(activeCat === cat.id ? "Tout" : cat.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    activeCat === cat.id
                      ? "bg-[#DC2626] text-white"
                      : "bg-white dark:bg-[#141414] text-gray-500 dark:text-gray-400 border border-[#ece8e3] dark:border-white/10"
                  }`}
                >
                  {cat.emoji ? `${cat.emoji} ` : ""}{cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-24 space-y-3">
          {/* Flash promos section */}
          {flashPromos.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5 px-1">
                <span>{"\u26A1"}</span> Promos Flash
              </h2>
              <div className="space-y-2">
                {flashPromos.map((p) => (
                  <PromoCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Standard promos */}
          {standardPromos.length > 0 && (
            <div>
              {flashPromos.length > 0 && (
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5 px-1 mt-4">
                  <span>{"\u{1F3F7}\uFE0F"}</span> Promotions
                </h2>
              )}
              <div className="space-y-2">
                {standardPromos.map((p) => (
                  <PromoCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">{"\u{1F525}"}</div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Aucune promo active
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Les offres apparaitront ici des qu&apos;un boucher en lancera
              </p>
              <Link
                href="/decouvrir"
                className="inline-block mt-4 px-4 py-2 bg-[#DC2626] text-white text-sm font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
              >
                Decouvrir les boutiques
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Promo Card ──
function PromoCard({ product }: { product: PromoProduct }) {
  const isFlash = product.promoType === "FLASH" && product.promoEnd;
  const discountedPrice = Math.round(product.priceCents * (1 - product.promoPct / 100));
  const imgSrc = product.images[0]?.url || product.imageUrl || getProductImage(product.category.name);

  return (
    <Link href={`/boutique/${product.shop.slug}`}>
      <div className={`flex gap-3 p-3 bg-white dark:bg-[#141414] rounded-[14px] border border-[#ece8e3] dark:border-white/10 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        isFlash ? "ring-1 ring-orange-300 dark:ring-orange-700" : ""
      }`}>
        {/* Image */}
        <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          <div className={`absolute top-0 left-0 px-1.5 py-0.5 text-white text-[9px] font-extrabold rounded-br-lg shadow-sm ${
            isFlash ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#DC2626]"
          }`}>
            -{product.promoPct}%
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{product.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {product.category.emoji ? `${product.category.emoji} ` : ""}{product.category.name}
                </span>
                {product.origin && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    {getFlag(product.origin)}
                  </span>
                )}
                {product.halalOrg && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ☪
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <span className="text-sm font-extrabold text-[#DC2626]">{fmtPrice(discountedPrice)}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 line-through">{fmtPrice(product.priceCents)}</span>
                <span className="text-[9px] text-gray-400">{unitLabel(product.unit)}</span>
              </div>
            </div>
          </div>

          {/* Bottom row: shop + countdown */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
              <MapPin size={10} />
              <span className="truncate">{product.shop.name}</span>
            </div>
            {isFlash && product.promoEnd && (
              <FlashCountdown promoEnd={product.promoEnd} />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
