// src/app/(client)/bons-plans/BonsPlansClient.tsx — Client-side promo listing
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame, ArrowLeft, MapPin, Tag, Copy, Check } from "lucide-react";
import { FlashCountdown } from "@/components/product/FlashCountdown";
import { resolveProductImage } from "@/lib/product-images";
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

type PlatformPromo = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  code: string | null;
  endsAt: string;
  shopName: string | null;
  shopSlug: string | null;
};

type CategoryInfo = { id: string; name: string; emoji: string | null };

interface Props {
  promos: PromoProduct[];
  categories: CategoryInfo[];
  platformPromos?: PlatformPromo[];
}

// ── Helpers ──
function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pce" : "/barq.";
}

function fmtPromoValue(p: PlatformPromo) {
  if (p.type === "PERCENT" && p.valuePercent) return `-${p.valuePercent}%`;
  if (p.type === "AMOUNT" && p.valueCents) return `-${(p.valueCents / 100).toFixed(0)}\u20AC`;
  return "Frais offerts";
}

function daysLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Expirée";
  const days = Math.ceil(diff / 86_400_000);
  if (days === 1) return "Dernier jour";
  return `${days}j restants`;
}

// ── Component ──
export function BonsPlansClient({ promos, categories, platformPromos = [] }: Props) {
  const [activeCat, setActiveCat] = useState("Tout");

  const filtered = activeCat === "Tout"
    ? promos
    : promos.filter((p) => p.category.id === activeCat);

  // Separate flash from standard
  const flashPromos = filtered.filter((p) => p.promoType === "FLASH" && p.promoEnd);
  const standardPromos = filtered.filter((p) => p.promoType !== "FLASH" || !p.promoEnd);

  const totalCount = promos.length + platformPromos.length;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] px-4 pt-12 pb-5">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/decouvrir"
              className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft size={15} className="text-white" />
            </Link>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Flame size={20} /> Bons plans
            </h1>
          </div>
          <p className="text-white/80 text-xs">
            {totalCount} offre{totalCount > 1 ? "s" : ""} active{totalCount > 1 ? "s" : ""}
            {flashPromos.length > 0 && (
              <span className="ml-1">dont {flashPromos.length} flash</span>
            )}
          </p>
        </div>

        {/* Platform promotions (codes, bons de reduction) */}
        {platformPromos.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wider mb-2 px-0.5">
              {"\u{1F381}"} Offres Klik&Go
            </p>
            <div className="space-y-2">
              {platformPromos.map((p) => (
                <PlatformPromoCard key={p.id} promo={p} />
              ))}
            </div>
          </div>
        )}

        {/* Category pills — compact, matching ShopProductsClient */}
        {promos.length > 0 && (
          <div className="sticky top-0 z-20 bg-[#f8f6f3]/70 dark:bg-[#0a0a0a]/70 backdrop-blur-xl px-3 py-2">
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setActiveCat("Tout")}
                className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                  activeCat === "Tout"
                    ? "bg-[#DC2626] text-white"
                    : "bg-white/80 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
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
                    className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                      activeCat === cat.id
                        ? "bg-[#DC2626] text-white"
                        : "bg-white/80 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {cat.emoji ? `${cat.emoji} ` : ""}{cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-3 pb-24 space-y-2">
          {/* Flash promos section */}
          {flashPromos.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wider mb-1.5 px-0.5">
                {"\u26A1"} Promos Flash
              </p>
              <div className="space-y-2">
                {flashPromos.map((p) => (
                  <ProductPromoCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Standard promos */}
          {standardPromos.length > 0 && (
            <div>
              {(flashPromos.length > 0 || platformPromos.length > 0) && (
                <p className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1.5 px-0.5 mt-3">
                  {"\u{1F3F7}\uFE0F"} Promotions produits
                </p>
              )}
              <div className="space-y-2">
                {standardPromos.map((p) => (
                  <ProductPromoCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {filtered.length === 0 && platformPromos.length === 0 && (
            <div className="text-center py-16">
              <div className="text-3xl mb-3">{"\u{1F525}"}</div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Aucune promo active
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Les offres apparaitront ici des qu&apos;un boucher en lancera
              </p>
              <Link
                href="/decouvrir"
                className="inline-block mt-4 px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-full hover:bg-[#b91c1c] transition-colors"
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

// ── Platform Promo Card (codes, bons de reduction) ──
function PlatformPromoCard({ promo }: { promo: PlatformPromo }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!promo.code) return;
    navigator.clipboard.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const content = (
    <div className="p-4 bg-gradient-to-r from-[#DC2626]/5 to-[#DC2626]/10 dark:from-[#DC2626]/10 dark:to-[#DC2626]/20 rounded-2xl border border-[#DC2626]/20 dark:border-[#DC2626]/30">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
          <Tag size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-[13px] text-gray-900 dark:text-white">{promo.label}</h3>
              {promo.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{promo.description}</p>
              )}
              {promo.shopName && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <MapPin size={9} />
                  <span>{promo.shopName}</span>
                </div>
              )}
            </div>
            <span className="text-sm font-extrabold text-[#DC2626] shrink-0">
              {fmtPromoValue(promo)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5">
            {promo.code ? (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyCode(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/10 border border-[#DC2626]/20 rounded-lg hover:bg-[#DC2626]/5 transition-colors"
              >
                <code className="text-xs font-mono font-bold text-[#DC2626]">{promo.code}</code>
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
              </button>
            ) : (
              <span className="text-[10px] text-[#DC2626] font-semibold bg-[#DC2626]/10 px-2 py-1 rounded-full">
                Automatique
              </span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {daysLeft(promo.endsAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // If linked to a specific shop, make it clickable
  if (promo.shopSlug) {
    return <Link href={`/boutique/${promo.shopSlug}`}>{content}</Link>;
  }

  return content;
}

// ── Product Promo Card ──
function ProductPromoCard({ product }: { product: PromoProduct }) {
  const isFlash = product.promoType === "FLASH" && product.promoEnd;
  const discountedPrice = Math.round(product.priceCents * (1 - product.promoPct / 100));
  const imgSrc = product.images[0]?.url || resolveProductImage({ name: product.name, imageUrl: product.imageUrl, category: product.category.name });

  return (
    <Link href={`/boutique/${product.shop.slug}`}>
      <div className={`flex gap-2.5 p-2.5 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3]/60 dark:border-white/[0.06] transition-all hover:shadow-md ${
        isFlash ? "ring-1 ring-orange-300/50 dark:ring-orange-700/50" : ""
      }`}>
        {/* Image */}
        <div className="relative w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 shrink-0">
          <Image src={imgSrc} alt={product.name} fill sizes="64px" className="object-cover" quality={70} />
          <div className={`absolute top-0 left-0 px-1.5 py-0.5 text-white text-[9px] font-extrabold rounded-br-lg ${
            isFlash ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#DC2626]"
          }`}>
            -{product.promoPct}%
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-[12px] text-gray-900 dark:text-white truncate">{product.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {product.category.emoji ? `${product.category.emoji} ` : ""}{product.category.name}
                </span>
                {product.origin && (
                  <span className="text-[10px]">
                    {getFlag(product.origin)}
                  </span>
                )}
                {product.halalOrg && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    ☪
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <span className="text-[13px] font-extrabold text-[#DC2626]">{fmtPrice(discountedPrice)}</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-gray-400 line-through">{fmtPrice(product.priceCents)}</span>
                <span className="text-[9px] text-gray-400">{unitLabel(product.unit)}</span>
              </div>
            </div>
          </div>

          {/* Bottom row: shop + countdown */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
              <MapPin size={9} />
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
