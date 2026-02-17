// src/components/product/ProductCard.tsx — V2 enriched product card
"use client";

import { useState, useCallback } from "react";
import { getProductImage } from "@/lib/product-images";
import { getFlag, getOriginCountry } from "@/lib/flags";
import type { Product as ProductV2, ProductImage as ProductImageType } from "@/types";

// ── Types ────────────────────────────────────────

export type ProductCardData = Pick<ProductV2,
  "id" | "shopId" | "name" | "description" | "imageUrl" | "priceCents" | "unit" |
  "inStock" | "tags" | "origin" | "halalOrg" | "race" | "popular" |
  "promoPct" | "promoEnd" | "promoType" | "freshness" | "customerNote"
> & {
  category: { id: string; name: string; emoji: string | null };
  images: ProductImageType[];
  labels: { id: string; name: string; color: string | null; icon: string | null }[];
};

interface Props {
  product: ProductCardData;
  productIndex?: number;
  onAdd: () => void;
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

function isFlashActive(promoEnd: string | null, promoType: string | null): boolean {
  if (promoType !== "FLASH" || !promoEnd) return false;
  return new Date(promoEnd).getTime() > Date.now();
}

// ── Image Carousel ──────────────────────────────

function ImageCarousel({ images, fallback, alt }: { images: ProductImageType[]; fallback: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const srcs = images.length > 0 ? images.map(i => i.url) : [fallback];
  const count = srcs.length;

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-[14px] bg-gray-100 dark:bg-white/5">
      <img
        src={srcs[idx]}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-300"
        loading="lazy"
      />
      {count > 1 && (
        <>
          {/* Swipe areas */}
          <button
            className="absolute inset-y-0 left-0 w-1/3 z-10"
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + count) % count); }}
            aria-label="Image précédente"
          />
          <button
            className="absolute inset-y-0 right-0 w-1/3 z-10"
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % count); }}
            aria-label="Image suivante"
          />
          {/* Dots */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {srcs.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-3" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────

export function ProductCard({ product, productIndex = 0, onAdd, style }: Props) {
  const [animating, setAnimating] = useState(false);
  const fallbackImg = product.imageUrl || getProductImage(product.category.name, productIndex);
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const flash = isFlashActive(product.promoEnd, product.promoType);
  const outOfStock = !product.inStock;

  const handleAdd = useCallback(() => {
    if (outOfStock) return;
    onAdd();
    if (product.unit !== "KG") {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
  }, [onAdd, outOfStock, product.unit]);

  return (
    <div
      className={`group relative flex flex-col bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-[18px] overflow-hidden
        transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.03)]
        hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#ddd5cc] dark:hover:border-white/20
        ${outOfStock ? "opacity-60" : ""} ${animating ? "scale-[0.97]" : ""}`}
      style={style}
    >
      {/* ── Image section ── */}
      <div className="relative">
        <ImageCarousel images={product.images} fallback={fallbackImg} alt={product.name} />

        {/* Promo badge top-left */}
        {hasPromo && (
          <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-white
            ${flash ? "bg-gradient-to-r from-red-600 to-orange-500 animate-pulse" : "bg-[#DC2626]"}`}>
            -{product.promoPct}%
            {flash && <span className="ml-1 text-[8px] font-bold">FLASH</span>}
          </div>
        )}

        {/* Popular badge top-right */}
        {product.popular && (
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-amber-500/90 text-white text-[9px] font-extrabold tracking-wide">
            POPULAIRE
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-[14px]">
            <span className="bg-white/90 dark:bg-black/80 text-gray-900 dark:text-white text-xs font-bold px-3 py-1 rounded-full">
              Rupture
            </span>
          </div>
        )}
      </div>

      {/* ── Info section ── */}
      <div className="flex-1 flex flex-col p-2.5 pt-2">
        {/* Category */}
        <span className="text-[8px] font-bold text-[#DC2626] uppercase tracking-wider mb-0.5">
          {product.category.emoji ? `${product.category.emoji} ` : ""}{product.category.name}
        </span>

        {/* Name */}
        <h3
          className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 font-serif"
        >
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            {product.description}
          </p>
        )}

        {/* Origin & Halal badges */}
        {(product.origin || product.halalOrg) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {product.origin && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded text-[8px] font-semibold text-blue-700 dark:text-blue-300">
                {getFlag(product.origin)} {getOriginCountry(product.origin)}
              </span>
            )}
            {product.halalOrg && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">
                ☪ {product.halalOrg}
              </span>
            )}
          </div>
        )}

        {/* Labels */}
        {product.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {product.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: label.color ? `${label.color}15` : "#f3f4f6",
                  color: label.color || "#6b7280",
                  border: `1px solid ${label.color ? `${label.color}30` : "#e5e7eb"}`,
                }}
              >
                {label.icon ? `${label.icon} ` : ""}{label.name}
              </span>
            ))}
          </div>
        )}

        {/* Race badge */}
        {product.race && (
          <span className="mt-1 inline-flex self-start px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded text-[8px] font-semibold text-orange-700 dark:text-orange-300">
            {product.race}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1 min-h-1" />

        {/* Price row + Add button */}
        <div className="flex items-end justify-between mt-2">
          <div>
            {hasPromo ? (
              <div className="flex items-baseline gap-1">
                <span className="text-[15px] font-extrabold text-[#DC2626]">
                  {fmtPrice(promoPrice(product.priceCents, product.promoPct!))}
                </span>
                <span className="text-[10px] text-gray-400 line-through">
                  {fmtPrice(product.priceCents)}
                </span>
              </div>
            ) : (
              <span className="text-[15px] font-extrabold text-gray-900 dark:text-white">
                {fmtPrice(product.priceCents)}
              </span>
            )}
            <span className="text-[9px] text-gray-400 font-medium">{unitLabel(product.unit)}</span>
          </div>

          {/* Add button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleAdd(); }}
            disabled={outOfStock}
            className={`min-h-[36px] px-3 rounded-xl text-[11px] font-bold transition-all duration-200 active:scale-95
              ${animating
                ? "bg-emerald-500 text-white"
                : outOfStock
                  ? "bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  : "bg-[#DC2626] text-white hover:bg-[#b91c1c] shadow-sm"
              }`}
          >
            {animating
              ? "\u2713 Ajouté"
              : product.unit === "KG"
                ? "Choisir"
                : "+ Ajouter"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
