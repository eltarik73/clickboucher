// src/components/product/ProductCard.tsx — V2 bis ultra-compact 4-col card with inline stepper
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Check, Minus } from "lucide-react";
import { resolveProductImage } from "@/lib/product-images";
import { getFlag } from "@/lib/flags";
import type { Product as ProductV2, ProductImage as ProductImageType } from "@/types";

// ── Types ────────────────────────────────────────

export type ProductCardData = Pick<ProductV2,
  "id" | "shopId" | "name" | "description" | "imageUrl" | "priceCents" | "unit" |
  "inStock" | "tags" | "origin" | "halalOrg" | "race" | "popular" |
  "promoPct" | "promoEnd" | "promoType" | "freshness" | "customerNote"
> & {
  category: { id: string; name: string; emoji: string | null };
  images: ProductImageType[];
  labels: { id: string; name: string; color: string | null }[];
};

interface Props {
  product: ProductCardData;
  productIndex?: number;
  onAdd: () => void;
  onTap?: () => void;
  cartQty?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  style?: React.CSSProperties;
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pce" : "/barq.";
}

function promoPrice(cents: number, pct: number) {
  return Math.round(cents * (1 - pct / 100));
}

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%231a1a1a'%3E%3Crect width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='40' fill='%23333'%3E🥩%3C/text%3E%3C/svg%3E";

// ── Main Component ──────────────────────────────

export function ProductCard({ product, productIndex = 0, onAdd, onTap, cartQty = 0, onIncrement, onDecrement, style }: Props) {
  const [animating, setAnimating] = useState(false);
  const imgSrc = product.images.length > 0
    ? product.images[0].url
    : resolveProductImage({ name: product.name, imageUrl: product.imageUrl, category: product.category.name });
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const outOfStock = !product.inStock;
  const isEager = productIndex < 4;
  const isKg = product.unit === "KG";
  const showStepper = cartQty > 0 && !isKg;

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    onAdd();
    if (!isKg) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
  }, [onAdd, outOfStock, isKg]);

  const handleIncrement = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onIncrement) onIncrement();
  }, [onIncrement]);

  const handleDecrement = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDecrement) onDecrement();
  }, [onDecrement]);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl
        bg-white dark:bg-[#141414]
        border border-gray-200 dark:border-white/[0.06]
        transition-transform duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]
        ${outOfStock ? "opacity-50" : ""}
        ${onTap ? "cursor-pointer" : ""}`}
      style={style}
      onClick={onTap}
    >
      {/* ── Image 4:3 ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-white/5">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={70}
          priority={isEager}
          loading={isEager ? "eager" : "lazy"}
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
        />

        {/* Promo badge — top-left */}
        {hasPromo && (
          <div
            className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(239,68,68,0.4)]
              ${product.promoType === "FLASH" ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#EF4444]"}`}
          >
            -{product.promoPct}%
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <span className="text-white text-[9px] font-bold bg-black/60 px-2 py-0.5 rounded-full">Indisponible</span>
          </div>
        )}
      </div>

      {/* ── Info zone ── */}
      <div className="px-2 pt-1.5 pb-2">
        {/* Nom — 12px, semibold, 1 ligne tronquée */}
        <h3 className="text-[12px] font-semibold leading-tight text-[#1A1A1A] dark:text-[#F5F5F5] truncate mb-[3px]">
          {product.name}
        </h3>

        {/* Badges — mini pills sous le nom */}
        {(product.origin || product.halalOrg) && (
          <div className="flex items-center gap-[3px] mb-1">
            {product.origin && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-[5px] py-px rounded-[3px] bg-blue-500/[0.12] dark:bg-blue-500/[0.12] text-blue-500 dark:text-blue-400 shrink-0">
                {getFlag(product.origin)}<span className="hidden md:inline lg:hidden"> {product.origin}</span>
              </span>
            )}
            {product.halalOrg && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-[5px] py-px rounded-[3px] bg-emerald-500/[0.12] dark:bg-emerald-500/[0.12] text-emerald-500 dark:text-emerald-400 shrink-0">
                ☪<span className="hidden md:inline lg:hidden"> {product.halalOrg}</span>
              </span>
            )}
            {product.labels.slice(0, 1).map((l) => (
              <span
                key={l.id}
                className="text-[8px] font-semibold px-[5px] py-px rounded-[3px] shrink-0"
                style={{
                  backgroundColor: l.color ? `${l.color}1F` : "rgba(251,191,36,0.12)",
                  color: l.color || "#FBBF24",
                }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {/* Prix + bouton "+" */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-0.5 min-w-0">
            {hasPromo ? (
              <>
                <span className="text-[13px] font-bold text-[#DC2626]">
                  {fmtPrice(promoPrice(product.priceCents, product.promoPct!))}
                </span>
                <span className="text-[9px] text-gray-400 line-through">
                  {fmtPrice(product.priceCents)}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-bold text-[#1A1A1A] dark:text-white">
                {fmtPrice(product.priceCents)}
              </span>
            )}
            <span className="text-[10px] text-[#717171]">{unitLabel(product.unit)}</span>
          </div>

          {/* Add / Stepper */}
          {!outOfStock && (
            showStepper ? (
              /* Inline quantity stepper [-] qty [+] */
              <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-[#DC2626]/20">
                <button
                  onClick={handleDecrement}
                  className="w-[24px] h-[24px] flex items-center justify-center bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 active:scale-90 transition-all"
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                <span className="w-[22px] text-center text-[11px] font-bold text-gray-900 dark:text-white tabular-nums">
                  {cartQty}
                </span>
                <button
                  onClick={handleIncrement}
                  className="w-[24px] h-[24px] flex items-center justify-center bg-[#DC2626] text-white hover:bg-[#b91c1c] active:scale-90 transition-all"
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              /* Initial "+" button */
              <button
                onClick={handleAdd}
                className={`w-[26px] h-[26px] rounded-lg flex items-center justify-center
                  transition-transform duration-150 hover:scale-[1.12] active:scale-[0.92]
                  ${animating
                    ? "bg-emerald-500 text-white"
                    : "bg-[#DC2626] text-white"
                  }`}
              >
                {animating ? <Check size={13} strokeWidth={3} /> : <Plus size={15} strokeWidth={2.5} />}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
