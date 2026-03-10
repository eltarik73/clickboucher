// src/components/client/ProductQuickAdd.tsx — Bottom sheet for quick add-to-cart from bons-plans pages
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ShoppingBag, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { computePrice, formatPrice, formatWeight } from "@/lib/estimate";

// ── Types ──

export interface QuickAddProduct {
  id: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  unit: string;
  category: string;
  categoryEmoji?: string;
  isAntiGaspi?: boolean;
  antiGaspiOrigPriceCents?: number | null;
  antiGaspiStock?: number | null;
  promoPct?: number | null;
  promoType?: string | null;
  promoFixedCents?: number | null;
}

export interface QuickAddShop {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  product: QuickAddProduct;
  shop: QuickAddShop;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ──

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const WEIGHT_PRESETS = [250, 500, 750, 1000, 1500, 2000];

// ── Component ──

export function ProductQuickAdd({ product, shop, isOpen, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [weightGrams, setWeightGrams] = useState(500);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const { addItem } = useCart();

  const isKg = product.unit === "KG" || product.unit === "TRANCHE";

  useEffect(() => {
    if (isOpen) {
      setWeightGrams(500);
      setQuantity(1);
      setImgError(false);
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  // Price calculation
  const effectivePrice = product.promoType === "FIXED_AMOUNT" && product.promoFixedCents
    ? Math.max(0, product.priceCents - product.promoFixedCents)
    : product.promoPct && product.promoPct > 0
    ? Math.round(product.priceCents * (1 - product.promoPct / 100))
    : product.priceCents;

  const prixAuKg = effectivePrice / 100;
  const totalEstimate = isKg
    ? computePrice(weightGrams, prixAuKg)
    : (effectivePrice * quantity) / 100;

  // Stock limit
  const maxStock = product.isAntiGaspi && product.antiGaspiStock != null ? product.antiGaspiStock : null;

  const handleAdd = () => {
    if (isKg) {
      addItem(
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          unit: product.unit as "KG" | "TRANCHE",
          priceCents: product.priceCents,
          quantity: 1,
          weightGrams,
          category: product.category,
          quantiteG: weightGrams,
          prixAuKg,
        },
        shop
      );
      toast.success(`${product.name} (${formatWeight(weightGrams)}) ajouté`, { icon: <ShoppingBag size={14} />, duration: 1500 });
    } else {
      addItem(
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          unit: product.unit as "PIECE" | "BARQUETTE",
          priceCents: effectivePrice,
          quantity,
          category: product.category,
        },
        shop
      );
      toast.success(`${product.name} ajouté au panier`, { icon: <ShoppingBag size={14} />, duration: 1500 });
    }
    navigator.vibrate?.(50);
    handleClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#FAF8F5] dark:bg-[#1a1a1a] rounded-t-[20px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header: image + name + price */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {/* Image */}
          <div className="relative w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #1C1512, #3D261A)" }}
              >
                <span className="text-2xl">{product.categoryEmoji || "🥩"}</span>
              </div>
            )}
          </div>

          {/* Name + shop */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-extrabold text-[#1C1512] dark:text-white truncate">
              {product.name}
            </h2>
            <Link
              href={`/boutique/${shop.slug}`}
              className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {shop.name} →
            </Link>
          </div>

          {/* Price + Close */}
          <div className="flex items-start gap-2 shrink-0">
            <div className="text-right">
              <span className="text-[20px] font-black text-[#DC2626] block leading-none">
                {fmtPrice(effectivePrice)}
              </span>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                {(product.isAntiGaspi && product.antiGaspiOrigPriceCents) && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 line-through">
                    {fmtPrice(product.antiGaspiOrigPriceCents)}
                  </span>
                )}
                {(product.promoPct && product.promoPct > 0 && !product.isAntiGaspi) && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 line-through">
                    {fmtPrice(product.priceCents)}
                  </span>
                )}
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  /{isKg ? "kg" : product.unit === "BARQUETTE" ? "barq." : "pce"}
                </span>
              </div>
            </div>
            <button onClick={handleClose} className="p-1 -mt-0.5" aria-label="Fermer">
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Anti-gaspi stock info */}
        {product.isAntiGaspi && maxStock !== null && (
          <div className="mx-4 mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Anti-gaspi — Reste {maxStock}
            </span>
          </div>
        )}

        {/* Weight / Quantity selector */}
        <div className="px-4 pb-3">
          {isKg ? (
            <>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Choisir le poids</p>
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {WEIGHT_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeightGrams(w)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                      weightGrams === w
                        ? "bg-[#DC2626] text-white"
                        : "bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {formatWeight(w)}
                  </button>
                ))}
              </div>
              {/* Fine-tune */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setWeightGrams(Math.max(100, weightGrams - 100))}
                  disabled={weightGrams <= 100}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30"
                >
                  <Minus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <div className="text-center min-w-[80px]">
                  <span className="text-2xl font-black text-[#1C1512] dark:text-white">{formatWeight(weightGrams)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWeightGrams(Math.min(5000, weightGrams + 100))}
                  disabled={weightGrams >= 5000}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30"
                >
                  <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                ⚖️ ±10% — ajustement au poids réel
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quantité</p>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30"
                >
                  <Minus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <span className="text-2xl font-black text-[#1C1512] dark:text-white min-w-[40px] text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(maxStock ?? 99, quantity + 1))}
                  disabled={maxStock !== null ? quantity >= maxStock : quantity >= 99}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center disabled:opacity-30"
                >
                  <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Total + CTA */}
        <div className="px-4 pb-8 pt-2 border-t border-gray-200/50 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">Total estimé</span>
            <span className="text-lg font-black text-[#1C1512] dark:text-white">{formatPrice(totalEstimate)}</span>
          </div>
          <button
            onClick={handleAdd}
            className="w-full h-12 bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)]"
          >
            <ShoppingBag size={16} />
            Ajouter au panier
          </button>
        </div>
      </div>
    </>
  );
}
