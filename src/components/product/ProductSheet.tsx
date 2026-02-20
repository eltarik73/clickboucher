// src/components/product/ProductSheet.tsx — Product detail bottom sheet (F1 Fusion Crème+Rouge)
"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
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

export function ProductSheet({ product, cartQty = 0, onAdd, onIncrement, onDecrement, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(1);

  // Reset qty when product changes
  useEffect(() => {
    if (product) {
      setQty(cartQty > 0 ? cartQty : 1);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [product, cartQty]);

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

  const hasImage = product.images.length > 0 || product.imageUrl;
  const imgSrc = product.images.length > 0
    ? product.images[0].url
    : resolveProductImage({ name: product.name, imageUrl: product.imageUrl, category: product.category.name });
  const hasPromo = product.promoPct != null && product.promoPct > 0;
  const isKg = product.unit === "KG";
  const effectivePrice = hasPromo ? promoPrice(product.priceCents, product.promoPct!) : product.priceCents;
  const totalPrice = effectivePrice * qty;

  function handleAdd() {
    // Fire onAdd for each qty increment needed
    onAdd();
    for (let i = 1; i < qty; i++) {
      onIncrement?.();
    }
    if (!isKg) handleClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] flex flex-col shadow-2xl transition-transform duration-200 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
        style={{ background: "#FAF8F5", borderRadius: "20px 20px 0 0" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center mt-2 mb-1 shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: "#D4C4B0" }} />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* ── Header image ── */}
          <div
            className="relative h-[120px] mx-3 mt-1 rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(145deg, #1C1512 0%, #2C2018 50%, #3D261A 100%)" }}
          >
            {hasImage ? (
              <img
                src={imgSrc}
                alt={product.name}
                width={400}
                height={120}
                loading="eager"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-5xl"
                  style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))" }}
                >
                  {product.category.emoji || "🥩"}
                </span>
              </div>
            )}

            {/* Promo badge */}
            {hasPromo && (
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-[#DC2626] text-white rounded-lg text-xs font-extrabold shadow-lg">
                -{product.promoPct}%
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm"
            >
              <X size={14} className="text-white/60" />
            </button>

            {/* Bottom overlay with category */}
            <div
              className="absolute bottom-0 inset-x-0"
              style={{ background: "linear-gradient(to top, rgba(28,21,18,0.8), transparent)", padding: "16px 14px 8px" }}
            >
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ color: "#C9A96E", letterSpacing: "2px", fontFamily: "Georgia, serif" }}
              >
                {product.category.emoji && `${product.category.emoji} `}{product.category.name}
              </span>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="px-5 pt-3.5 pb-3">
            {/* Name */}
            <h2
              className="text-xl font-extrabold leading-tight"
              style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
            >
              {product.name}
            </h2>

            {/* Price row */}
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[28px] font-black text-[#DC2626]">
                {fmtPrice(effectivePrice)}
              </span>
              {hasPromo && (
                <span className="text-sm line-through" style={{ color: "#C4B5A3" }}>
                  {fmtPrice(product.priceCents)}
                </span>
              )}
              <span className="text-sm" style={{ color: "#A08060" }}>
                {unitLabel(product.unit)}
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p
                className="mt-2.5 leading-relaxed italic line-clamp-2"
                style={{ fontSize: "13px", color: "#8B7355", fontFamily: "Georgia, serif" }}
              >
                {product.description}
              </p>
            )}

            {/* Separator */}
            <div
              className="my-3 h-px"
              style={{ background: "linear-gradient(to right, transparent, #D4C4B0, transparent)" }}
            />

            {/* Badges */}
            <div className="flex gap-1.5 flex-wrap">
              {product.origin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                  {getFlag(product.origin)} {product.origin}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                  ☪ Halal {product.halalOrg}
                </span>
              )}
              {product.freshness && product.freshness !== "STANDARD" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                  {product.freshness === "EXTRA_FRESH" ? "❄ Extra frais" : product.freshness === "FROZEN" ? "❄ Surgele" : product.freshness === "FRAIS" ? "❄ Frais" : product.freshness}
                </span>
              )}
              {product.race && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                  🐄 Race {product.race}
                </span>
              )}
              {product.labels.map((l) => (
                <span
                  key={l.id}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                  style={{
                    backgroundColor: l.color ? `${l.color}1F` : "#FFF7ED",
                    color: l.color || "#C2410C",
                    borderColor: l.color ? `${l.color}40` : "#FED7AA",
                  }}
                >
                  {l.name}
                </span>
              ))}
            </div>

            {/* Weight note for /kg products */}
            {isKg && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#FEF3C7]">
                <p className="text-[11px] font-medium" style={{ color: "#92400E" }}>
                  ⚖️ Le poids final peut varier de ±10% selon la coupe
                </p>
              </div>
            )}

            {/* Customer note */}
            {product.customerNote && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg" style={{ background: "#F5F0EB" }}>
                <p className="text-[11px] italic" style={{ color: "#8B7355", fontFamily: "Georgia, serif" }}>
                  {product.customerNote}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom bar (sticky, outside scroll) ── */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 py-2.5"
          style={{ borderTop: "1px solid #EDE5DA", paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          {!product.inStock ? (
            <div
              className="flex-1 h-[46px] flex items-center justify-center rounded-xl text-sm font-bold"
              style={{ background: "#F5F0EB", color: "#C4B5A3" }}
            >
              Indisponible
            </div>
          ) : isKg ? (
            <button
              onClick={() => { onAdd(); handleClose(); }}
              className="flex-1 h-[46px] rounded-xl flex items-center justify-center gap-2 text-white active:scale-[0.97] transition-transform"
              style={{ background: "#DC2626", boxShadow: "0 4px 14px rgba(220,38,38,0.2)" }}
            >
              <span className="text-[15px] font-extrabold">Choisir le poids</span>
            </button>
          ) : (
            <>
              {/* Quantity selector */}
              <div
                className="flex items-center rounded-xl"
                style={{ background: "#F5F0EB", border: "1px solid #E8DFD4" }}
              >
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-11 flex items-center justify-center text-[17px] font-extrabold active:scale-90 transition-transform"
                  style={{ color: qty <= 1 ? "#D4C4B0" : "#8B7355" }}
                  aria-label="Diminuer la quantite"
                >
                  −
                </button>
                <span
                  className="w-7 text-center text-[17px] font-extrabold tabular-nums"
                  style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
                >
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  className="w-10 h-11 flex items-center justify-center text-[17px] font-extrabold text-[#DC2626] active:scale-90 transition-transform"
                  aria-label="Augmenter la quantite"
                >
                  +
                </button>
              </div>

              {/* CTA button */}
              <button
                onClick={handleAdd}
                className="flex-1 h-[46px] rounded-xl flex items-center justify-center gap-2 text-white active:scale-[0.97] transition-transform"
                style={{ background: "#DC2626", boxShadow: "0 4px 14px rgba(220,38,38,0.2)" }}
              >
                <span className="text-[15px] font-extrabold">Ajouter</span>
                <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-sm font-black">
                  {fmtPrice(totalPrice)}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
