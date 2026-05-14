// src/app/(client)/bons-plans/BonsPlansClient.tsx — Client-side promo listing
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Tag, Copy, Check } from "lucide-react";
import { FlashCountdown } from "@/components/product/FlashCountdown";
import { resolveProductImage } from "@/lib/product-images";
import { getFlag } from "@/lib/flags";
import { BonsPlansProductCard } from "@/components/client/BonsPlansProductCard";

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
  promoFixedCents: number | null;
  origin: string | null;
  halalOrg: string | null;
  categories: { id: string; name: string; emoji: string | null }[];
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

  const filtered =
    activeCat === "Tout"
      ? promos
      : promos.filter((p) => p.categories.some((c) => c.id === activeCat));

  // Separate flash from standard
  const flashPromos = filtered.filter((p) => p.promoType === "FLASH" && p.promoEnd);
  const standardPromos = filtered.filter((p) => p.promoType !== "FLASH" || !p.promoEnd);

  const totalCount = promos.length + platformPromos.length;

  return (
    <div>
      {/* Stats — audit a11y 2026-05-10 : text-gray-500 sur fond crème = fail AA */}
      <div className="px-4 py-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {totalCount} offre{totalCount > 1 ? "s" : ""} active{totalCount > 1 ? "s" : ""}
          {flashPromos.length > 0 && <span className="ml-1">dont {flashPromos.length} flash</span>}
        </p>
      </div>

      {/* Platform promotions (codes, bons de reduction) */}
      {platformPromos.length > 0 && (
        <div className="px-3 pb-1 pt-3">
          <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
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
        <div className="sticky top-0 z-20 bg-[#f8f6f3]/70 px-3 py-2 backdrop-blur-xl dark:bg-[#0a0a0a]/70">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCat("Tout")}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-semibold transition-all ${
                activeCat === "Tout"
                  ? "bg-[#DC2626] text-white"
                  : "bg-white/80 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
              }`}
            >
              Tout ({promos.length})
            </button>
            {categories.map((cat) => {
              const count = promos.filter((p) => p.categories.some((c) => c.id === cat.id)).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(activeCat === cat.id ? "Tout" : cat.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-semibold transition-all ${
                    activeCat === cat.id
                      ? "bg-[#DC2626] text-white"
                      : "bg-white/80 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
                  }`}
                >
                  {cat.emoji ? `${cat.emoji} ` : ""}
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2 px-3 pb-24">
        {/* Flash promos section */}
        {flashPromos.length > 0 && (
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
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
              <p className="mb-1.5 mt-3 px-0.5 text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">
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
          <div className="py-16 text-center">
            <div className="mb-3 text-3xl" aria-hidden="true">
              {"\u{1F525}"}
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Aucune promo active
            </p>
            <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
              Les offres apparaitront ici des qu&apos;un boucher en lancera
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              Découvrir les boutiques
            </Link>
          </div>
        )}
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
    <div className="rounded-2xl border border-[#DC2626]/20 bg-gradient-to-r from-[#DC2626]/5 to-[#DC2626]/10 p-4 dark:border-[#DC2626]/30 dark:from-[#DC2626]/10 dark:to-[#DC2626]/20">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DC2626]">
          <Tag size={20} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{promo.label}</h3>
              {promo.description && (
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {promo.description}
                </p>
              )}
              {promo.shopName && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                  <MapPin size={9} />
                  <span>{promo.shopName}</span>
                </div>
              )}
            </div>
            <span className="shrink-0 text-sm font-extrabold text-[#DC2626]">
              {fmtPromoValue(promo)}
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            {promo.code ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyCode();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#DC2626]/20 bg-white px-3 py-1.5 transition-colors hover:bg-[#DC2626]/5 dark:bg-white/10"
              >
                <code className="font-mono text-xs font-bold text-[#DC2626]">{promo.code}</code>
                {copied ? (
                  <Check size={12} className="text-green-500" />
                ) : (
                  <Copy size={12} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>
            ) : (
              <span className="rounded-full bg-[#DC2626]/10 px-2 py-1 text-[10px] font-semibold text-[#DC2626]">
                Automatique
              </span>
            )}
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
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
  const isFixedAmount = product.promoType === "FIXED_AMOUNT" && product.promoFixedCents;
  const discountedPrice = isFixedAmount
    ? Math.max(0, product.priceCents - (product.promoFixedCents || 0))
    : Math.round(product.priceCents * (1 - product.promoPct / 100));
  const imgSrc =
    product.images[0]?.url ||
    resolveProductImage({
      name: product.name,
      imageUrl: product.imageUrl,
      category: product.categories[0]?.name || "",
    });

  return (
    <BonsPlansProductCard
      product={{
        id: product.id,
        name: product.name,
        imageUrl: imgSrc,
        priceCents: product.priceCents,
        unit: product.unit,
        category: product.categories[0]?.name || "",
        categoryEmoji: product.categories[0]?.emoji || undefined,
        promoPct: product.promoPct,
        promoType: product.promoType,
      }}
      shop={product.shop}
    >
      <div
        className={`flex gap-2.5 rounded-2xl border border-[#ece8e3]/60 bg-white p-2.5 transition-all hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800 ${
          isFlash ? "ring-1 ring-orange-300/50 dark:ring-orange-700/50" : ""
        }`}
      >
        {/* Image */}
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            sizes="64px"
            className="object-cover"
            quality={70}
          />
          <div
            className={`absolute left-0 top-0 rounded-br-lg px-1.5 py-0.5 text-[11px] font-extrabold text-white ${
              isFlash ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#DC2626]"
            }`}
          >
            {isFixedAmount
              ? `-${((product.promoFixedCents || 0) / 100).toFixed(0)}€`
              : `-${product.promoPct}%`}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[12px] font-bold text-gray-900 dark:text-white">
                {product.name}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {product.categories
                    .map((c) => `${c.emoji ? c.emoji + " " : ""}${c.name}`)
                    .join(", ")}
                </span>
                {product.origin && <span className="text-[10px]">{getFlag(product.origin)}</span>}
                {product.halalOrg && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">☪</span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="shrink-0 text-right">
              <span className="text-[13px] font-extrabold text-[#DC2626]">
                {fmtPrice(discountedPrice)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-500 line-through dark:text-gray-400">
                  {fmtPrice(product.priceCents)}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {unitLabel(product.unit)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row: shop + countdown */}
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
              <MapPin size={9} />
              <span className="truncate">{product.shop.name}</span>
            </div>
            {isFlash && product.promoEnd && <FlashCountdown promoEnd={product.promoEnd} />}
          </div>
        </div>
      </div>
    </BonsPlansProductCard>
  );
}
