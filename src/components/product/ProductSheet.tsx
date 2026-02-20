// src/components/product/ProductSheet.tsx — Floating mini card (F1 Fusion Crème+Rouge)
"use client";

import { useCallback, useEffect, useState } from "react";
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
    setTimeout(onClose, 300);
  }, [onClose]);

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
    onAdd();
    for (let i = 1; i < qty; i++) {
      onIncrement?.();
    }
    if (!isKg) handleClose();
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={handleClose}
      >
        {/* Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-[340px] max-w-[calc(100vw-32px)] overflow-hidden transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          style={{
            background: "#FAF8F5",
            borderRadius: "20px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}
        >
          {/* ── Close button ── */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3.5 z-10 text-sm cursor-pointer"
            style={{ color: "#C4B5A3" }}
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* ── Header row: emoji/img + name + price ── */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
            {/* Emoji / Image square */}
            <div className="relative w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden">
              {hasImage ? (
                <img
                  src={imgSrc}
                  alt={product.name}
                  width={56}
                  height={56}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #1C1512, #3D261A)" }}
                >
                  <span
                    className="text-3xl"
                    style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))" }}
                  >
                    {product.category.emoji || "🥩"}
                  </span>
                </div>
              )}
              {/* Promo badge */}
              {hasPromo && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow">
                  -{product.promoPct}%
                </span>
              )}
            </div>

            {/* Name + category */}
            <div className="flex-1 min-w-0">
              <h2
                className="text-[15px] font-extrabold leading-tight truncate"
                style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
              >
                {product.name}
              </h2>
              <p
                className="mt-0.5 uppercase truncate"
                style={{ fontSize: "10px", color: "#C9A96E", letterSpacing: "1.5px", fontFamily: "Georgia, serif" }}
              >
                {product.category.emoji && `${product.category.emoji} `}{product.category.name}
              </p>
            </div>

            {/* Price */}
            <div className="flex-shrink-0 text-right">
              <span className="text-[22px] font-black text-[#DC2626] block leading-none">
                {fmtPrice(effectivePrice)}
              </span>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                {hasPromo && (
                  <span className="text-[11px] line-through" style={{ color: "#C4B5A3" }}>
                    {fmtPrice(product.priceCents)}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: "#A08060" }}>
                  {unitLabel(product.unit)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Body: description + badges ── */}
          <div className="px-3.5 pt-2">
            {/* Description */}
            {product.description && (
              <p
                className="italic line-clamp-2"
                style={{ fontSize: "12px", color: "#8B7355", fontFamily: "Georgia, serif" }}
              >
                {product.description}
              </p>
            )}

            {/* Badges */}
            {(product.origin || product.halalOrg || product.race || (product.freshness && product.freshness !== "STANDARD") || product.labels.length > 0) && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {product.origin && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                    {getFlag(product.origin)} {product.origin}
                  </span>
                )}
                {product.halalOrg && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                    ☪ Halal {product.halalOrg}
                  </span>
                )}
                {product.freshness && product.freshness !== "STANDARD" && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                    {product.freshness === "EXTRA_FRESH" ? "❄ Extra frais" : product.freshness === "FROZEN" ? "❄ Surgele" : product.freshness === "FRAIS" ? "❄ Frais" : product.freshness}
                  </span>
                )}
                {product.race && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                    🐄 {product.race}
                  </span>
                )}
                {product.labels.map((l) => (
                  <span
                    key={l.id}
                    className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold border"
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
            )}

            {/* Weight note */}
            {isKg && (
              <span
                className="inline-block mt-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
                style={{ background: "#FFFBEB", color: "#92400E" }}
              >
                ⚖️ ±10%
              </span>
            )}
          </div>

          {/* ── Bottom bar: qty + CTA ── */}
          <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-2.5 mt-1">
            {!product.inStock ? (
              <div
                className="flex-1 h-10 flex items-center justify-center rounded-[10px] text-sm font-bold"
                style={{ background: "#F5F0EB", color: "#C4B5A3" }}
              >
                Indisponible
              </div>
            ) : isKg ? (
              <button
                onClick={() => { onAdd(); handleClose(); }}
                className="flex-1 h-10 rounded-[10px] flex items-center justify-center gap-2 text-white text-sm font-extrabold active:scale-[0.97] transition-transform"
                style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
              >
                Choisir le poids
              </button>
            ) : (
              <>
                {/* Quantity selector */}
                <div
                  className="flex items-center"
                  style={{ background: "#F5F0EB", borderRadius: "10px", border: "1px solid #E8DFD4" }}
                >
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex items-center justify-center text-[15px] font-extrabold active:scale-90 transition-transform"
                    style={{ width: "34px", height: "38px", color: qty <= 1 ? "#D4C4B0" : "#8B7355" }}
                    aria-label="Diminuer la quantite"
                  >
                    −
                  </button>
                  <span
                    className="w-5 text-center text-sm font-black tabular-nums"
                    style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    className="flex items-center justify-center text-[15px] font-extrabold text-[#DC2626] active:scale-90 transition-transform"
                    style={{ width: "34px", height: "38px" }}
                    aria-label="Augmenter la quantite"
                  >
                    +
                  </button>
                </div>

                {/* CTA */}
                <button
                  onClick={handleAdd}
                  className="flex-1 h-10 rounded-[10px] flex items-center justify-center gap-2 text-white text-sm font-extrabold active:scale-[0.97] transition-transform"
                  style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
                >
                  Ajouter
                  <span className="bg-white/20 px-2 py-0.5 rounded-md text-[13px] font-black">
                    {fmtPrice(totalPrice)}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
