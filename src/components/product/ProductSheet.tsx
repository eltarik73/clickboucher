// src/components/product/ProductSheet.tsx — Product detail bottom sheet
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, Plus, Minus, ShoppingBag, MapPin, Leaf, Award } from "lucide-react";
import { resolveProductImage } from "@/lib/product-images";
import { getFlag } from "@/lib/flags";
import type { ProductCardData } from "./ProductCard";

interface Props {
  product: ProductCardData | null;
  cartQty?: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onClose: () => void;
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/piece" : "/barquette";
}

function promoPrice(cents: number, pct: number) {
  return Math.round(cents * (1 - pct / 100));
}

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225' fill='%231a1a1a'%3E%3Crect width='400' height='225'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='40' fill='%23333'%3E🥩%3C/text%3E%3C/svg%3E";

export function ProductSheet({ product, cartQty = 0, onAdd, onIncrement, onDecrement, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (product) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [product]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [product, handleClose]);

  if (!product) return null;

  const imgSrc = product.images.length > 0
    ? product.images[0].url
    : resolveProductImage({ name: product.name, imageUrl: product.imageUrl, category: product.category.name });
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const isKg = product.unit === "KG";
  const effectivePrice = hasPromo ? promoPrice(product.priceCents, product.promoPct!) : product.priceCents;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] bg-white dark:bg-[#141414] rounded-t-3xl shadow-2xl transition-transform duration-200 ease-out flex flex-col ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Pull handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center z-10"
        >
          <X size={16} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Image — 16:9 capped at 180px */}
          <div className="relative w-full max-h-[180px] aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-white/5 mx-auto">
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 500px"
              className="object-cover"
              quality={80}
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
            />
            {hasPromo && (
              <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#DC2626] text-white text-xs font-bold rounded-lg shadow-lg">
                -{product.promoPct}%
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-4 pt-3 pb-4">
            {/* Title + Price */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {product.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {product.category.emoji && `${product.category.emoji} `}{product.category.name}
                </p>
              </div>
              <div className="text-right shrink-0">
                {hasPromo ? (
                  <>
                    <p className="text-2xl font-bold text-[#DC2626]">
                      {fmtPrice(promoPrice(product.priceCents, product.promoPct!))}
                    </p>
                    <p className="text-xs text-gray-400 line-through">
                      {fmtPrice(product.priceCents)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {fmtPrice(product.priceCents)}
                  </p>
                )}
                <p className="text-xs text-gray-400">{unitLabel(product.unit)}</p>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
                {product.description}
              </p>
            )}

            {/* Info badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {product.origin && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                  <MapPin size={11} />
                  {getFlag(product.origin)} {product.origin}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                  <Award size={11} />
                  Halal {product.halalOrg}
                </span>
              )}
              {product.race && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                  <Leaf size={11} />
                  Race {product.race}
                </span>
              )}
              {product.freshness && product.freshness !== "STANDARD" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400">
                  {product.freshness === "EXTRA_FRESH" ? "Extra frais" : product.freshness === "FROZEN" ? "Surgele" : product.freshness}
                </span>
              )}
              {product.labels.map((l) => (
                <span
                  key={l.id}
                  className="text-xs font-medium px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: l.color ? `${l.color}1F` : "rgba(251,191,36,0.12)",
                    color: l.color || "#FBBF24",
                  }}
                >
                  {l.name}
                </span>
              ))}
            </div>

            {/* Customer note */}
            {product.customerNote && (
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  {product.customerNote}
                </p>
              </div>
            )}

            {/* Quantity selector (for PIECE/BARQUETTE items already in cart) */}
            {cartQty > 0 && !isKg && (
              <div className="flex items-center justify-center gap-4 py-3">
                <button
                  onClick={onDecrement}
                  aria-label="Diminuer la quantite"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all"
                >
                  <Minus size={18} />
                </button>
                <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums min-w-[3ch] text-center">
                  {cartQty}
                </span>
                <button
                  onClick={onIncrement}
                  aria-label="Augmenter la quantite"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom action bar — sticky */}
        <div className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#141414]">
          {!product.inStock ? (
            <div className="w-full h-12 flex items-center justify-center text-sm font-semibold text-gray-400 bg-gray-100 dark:bg-white/5 rounded-xl">
              Indisponible
            </div>
          ) : (
            <button
              onClick={() => { onAdd(); if (!isKg) handleClose(); }}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-sm font-bold rounded-xl transition-colors active:scale-[0.98]"
            >
              <ShoppingBag size={16} />
              {isKg
                ? "Choisir le poids"
                : cartQty > 0
                  ? `Ajouter · ${fmtPrice(effectivePrice * (cartQty + 1))}`
                  : `Ajouter au panier · ${fmtPrice(effectivePrice)}`
              }
            </button>
          )}
        </div>
      </div>
    </>
  );
}
