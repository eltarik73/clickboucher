// src/components/client/ProductQuickAdd.tsx — Bottom sheet for quick add-to-cart from bons-plans pages
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ShoppingBag, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { formatWeight } from "@/lib/estimate";
import { cartLineId } from "@/lib/cart/cart-line";
import { parseSaleUnit } from "@/lib/cart/stored-cart";
import { displayedUnitPrice } from "@/lib/pricing/display";
import { isWeighedUnit, lineTotalCents, MAX_LINE_QUANTITY } from "@/lib/pricing/line";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { limitedStockRemaining, limitedStockSoldOut } from "@/lib/pricing/limited-stock";

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
  isFlashSale?: boolean;
  flashSaleStock?: number | null;
  promoPct?: number | null;
  promoType?: string | null;
  promoFixedCents?: number | null;
  /** End of the product promotion (ISO). Absent = no end date. */
  promoEnd?: string | null;
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
  /** When the sheet was opened: the displayed prices are resolved at that time. */
  const [pricedAt, setPricedAt] = useState<Date | null>(null);
  const { addItem } = useCart();

  const unit = parseSaleUnit(product.unit);
  const isKg = unit !== null && isWeighedUnit(unit);

  useEffect(() => {
    if (isOpen) {
      setPricedAt(new Date());
      setWeightGrams(500);
      setQuantity(1);
      setImgError(false);
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      setPricedAt(null);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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

  if (!isOpen || pricedAt === null || unit === null) return null;

  const price = displayedUnitPrice(product, pricedAt);
  const totalEstimate = isKg
    ? lineTotalCents({ unit, quantity: 1, weightGrams }, price.unitPriceCents)
    : lineTotalCents({ unit, quantity }, price.unitPriceCents);

  const maxStock = limitedStockRemaining(product);
  const soldOut = limitedStockSoldOut(product);
  const maxQty = Math.min(maxStock ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);

  const handleAdd = () => {
    if (soldOut) return;
    const resolved = resolveUnitPrice(product, { isPro: false, now: new Date() });
    if (!resolved.ok) return;
    const base = {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      priceCents: resolved.unitPriceCents,
      category: product.category,
    };
    if (unit === "KG" || unit === "TRANCHE") {
      const line = { productId: product.id, unit, weightGrams };
      addItem({ ...base, ...line, id: cartLineId(line), quantity: 1 }, shop);
      toast.success(`${product.name} (${formatWeight(weightGrams)}) ajouté`, {
        icon: <ShoppingBag size={14} />,
        duration: 1500,
      });
    } else {
      const line = { productId: product.id, unit };
      addItem({ ...base, ...line, id: cartLineId(line), quantity }, shop);
      toast.success(`${product.name} ajouté au panier`, {
        icon: <ShoppingBag size={14} />,
        duration: 1500,
      });
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
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[20px] bg-[#FAF8F5] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out dark:bg-[#1a1a1a] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header: image + name + price */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {/* Image */}
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width={56}
                height={56}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: "linear-gradient(145deg, #1C1512, #3D261A)" }}
              >
                <span className="text-2xl">{product.categoryEmoji || "🥩"}</span>
              </div>
            )}
          </div>

          {/* Name + shop */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-extrabold text-[#1C1512] dark:text-white">
              {product.name}
            </h2>
            <Link
              href={`/boutique/${shop.slug}`}
              className="text-[11px] text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400"
              onClick={(e) => e.stopPropagation()}
            >
              {shop.name} →
            </Link>
          </div>

          {/* Price + Close */}
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <span className="block text-[20px] font-black leading-none text-[#DC2626]">
                {fmtPrice(price.unitPriceCents)}
              </span>
              <div className="mt-0.5 flex items-center justify-end gap-1">
                {product.isAntiGaspi && product.antiGaspiOrigPriceCents && (
                  <span className="text-[10px] text-gray-500 line-through dark:text-gray-400">
                    {fmtPrice(product.antiGaspiOrigPriceCents)}
                  </span>
                )}
                {price.promo !== null && !product.isAntiGaspi && (
                  <span className="text-[10px] text-gray-500 line-through dark:text-gray-400">
                    {fmtPrice(price.baseCents)}
                  </span>
                )}
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  /{isKg ? "kg" : product.unit === "BARQUETTE" ? "barq." : "pce"}
                </span>
              </div>
            </div>
            <button onClick={handleClose} className="-mt-0.5 p-1" aria-label="Fermer">
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Limited stock info (anti-gaspi or flash sale) */}
        {maxStock !== null && maxStock > 0 && (
          <div className="mx-4 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {product.isAntiGaspi ? "Anti-gaspi" : "Vente flash"} — Reste {maxStock}
            </span>
          </div>
        )}

        {/* Weight / Quantity selector */}
        <div className="px-4 pb-3">
          {isKg ? (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Choisir le poids
              </p>
              {/* Presets */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {WEIGHT_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeightGrams(w)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                      weightGrams === w
                        ? "bg-[#DC2626] text-white"
                        : "border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-30 dark:border-white/10 dark:bg-white/5"
                >
                  <Minus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <div className="min-w-[80px] text-center">
                  <span className="text-2xl font-black text-[#1C1512] dark:text-white">
                    {formatWeight(weightGrams)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWeightGrams(Math.min(5000, weightGrams + 100))}
                  disabled={weightGrams >= 5000}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-30 dark:border-white/10 dark:bg-white/5"
                >
                  <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-gray-500 dark:text-gray-400">
                ⚖️ ±10% — ajustement au poids réel
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Quantité
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-30 dark:border-white/10 dark:bg-white/5"
                >
                  <Minus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <span className="min-w-[40px] text-center text-2xl font-black text-[#1C1512] dark:text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                  disabled={quantity >= maxQty}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white disabled:opacity-30 dark:border-white/10 dark:bg-white/5"
                >
                  <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Total + CTA */}
        <div className="border-t border-gray-200/50 px-4 pb-8 pt-2 dark:border-white/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">Total estimé</span>
            <span className="text-lg font-black text-[#1C1512] dark:text-white">
              {fmtPrice(totalEstimate)}
            </span>
          </div>
          <button
            onClick={handleAdd}
            disabled={soldOut}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#DC2626] text-[14px] font-bold text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] transition-all hover:bg-[#b91c1c] active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-400"
          >
            <ShoppingBag size={16} />
            {soldOut ? "Épuisé" : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </>
  );
}
