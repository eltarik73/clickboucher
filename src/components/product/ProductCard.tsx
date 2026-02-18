// src/components/product/ProductCard.tsx — Uber Eats style compact card
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Check } from "lucide-react";
import { getProductImage } from "@/lib/product-images";
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

export function ProductCard({ product, productIndex = 0, onAdd, style }: Props) {
  const [animating, setAnimating] = useState(false);
  const imgSrc = product.images.length > 0
    ? product.images[0].url
    : product.imageUrl || getProductImage(product.category.name, productIndex);
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const outOfStock = !product.inStock;

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    onAdd();
    if (product.unit !== "KG") {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }
  }, [onAdd, outOfStock, product.unit]);

  return (
    <div
      className={`group relative bg-white dark:bg-white/[0.03] rounded-2xl overflow-hidden
        transition-all duration-150 active:scale-[0.97]
        ${outOfStock ? "opacity-50" : ""}`}
      style={style}
    >
      {/* ── Image ── */}
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-white/5">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 46vw, 180px"
          className="object-cover"
          quality={70}
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
        />

        {/* Promo badge */}
        {hasPromo && (
          <div className={`absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white
            ${product.promoType === "FLASH" ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-[#DC2626]"}`}>
            -{product.promoPct}%
          </div>
        )}

        {/* "+" button overlay bottom-right */}
        {!outOfStock && (
          <button
            onClick={handleAdd}
            className={`absolute bottom-1.5 right-1.5 z-10 w-8 h-8 rounded-full flex items-center justify-center
              shadow-lg transition-all duration-150 active:scale-90
              ${animating
                ? "bg-emerald-500 text-white"
                : "bg-white dark:bg-white/90 text-gray-900 hover:bg-gray-100"
              }`}
          >
            {animating ? <Check size={16} strokeWidth={3} /> : <Plus size={18} strokeWidth={2.5} />}
          </button>
        )}

        {/* Out of stock */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <span className="text-white text-[10px] font-bold bg-black/60 px-2 py-0.5 rounded-full">Indisponible</span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="px-1.5 pt-1.5 pb-2">
        <h3 className="text-[12px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-1">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-1 mt-0.5">
          {hasPromo ? (
            <>
              <span className="text-[13px] font-bold text-[#DC2626]">
                {fmtPrice(promoPrice(product.priceCents, product.promoPct!))}
              </span>
              <span className="text-[10px] text-gray-400 line-through">
                {fmtPrice(product.priceCents)}
              </span>
            </>
          ) : (
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">
              {fmtPrice(product.priceCents)}
            </span>
          )}
          <span className="text-[9px] text-gray-400">{unitLabel(product.unit)}</span>
        </div>
      </div>
    </div>
  );
}
