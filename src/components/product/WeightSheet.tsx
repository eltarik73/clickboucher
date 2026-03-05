// src/components/product/WeightSheet.tsx — F1 Fusion floating mini card for weight products
"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { getConversionRule } from "@/lib/conversion-config";
import { computePrice, formatPrice } from "@/lib/estimate";
import { getFlag } from "@/lib/flags";

export interface WeightSheetProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: string;
  priceCents: number;
  minWeightG?: number | null;
  weightStepG?: number | null;
  maxWeightG?: number | null;
  origin?: string | null;
  halalOrg?: string | null;
  race?: string | null;
  freshness?: string | null;
  variants?: string[] | null;
  weightPerPiece?: number | null;
  pieceLabel?: string | null;
  weightMargin?: number | null;
  cutOptions?: Array<{ name: string; priceCents: number }> | null;
}

interface Props {
  product: WeightSheetProduct | null;
  onConfirm: (weightG: number, options?: { variant?: string; pieceCount?: number; pieceLabel?: string; cutOption?: string; cutPriceCents?: number }) => void;
  onClose: () => void;
}

export function WeightSheet({ product, onConfirm, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(500);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedCut, setSelectedCut] = useState<{ name: string; priceCents: number } | null>(null);
  const [pieceMode, setPieceMode] = useState(false);
  const [pieceCount, setPieceCount] = useState(6);

  const rule = product ? getConversionRule(product.category) : null;

  const effectiveMin = product?.minWeightG ?? rule?.minG ?? 100;
  const effectiveStep = product?.weightStepG ?? rule?.pasG ?? 50;
  const effectiveMax = product?.maxWeightG ?? rule?.maxG ?? 5000;

  // Reset qty and animate in when product changes
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const r = getConversionRule(product.category);
    const d = r.presetsG[1] ?? r.presetsG[0] ?? (product.minWeightG ?? r.minG);
    setQty(d);
    setSelectedVariant(null);
    setSelectedCut(null);
    setPieceMode(false);
    setPieceCount(6);
  }

  useEffect(() => {
    if (product) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [product]);

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

  if (!product || !rule) return null;

  const effectiveRule = {
    ...rule,
    minG: effectiveMin,
    pasG: effectiveStep,
    maxG: effectiveMax,
    presetsG: rule.presetsG.filter((p) => p >= effectiveMin && p <= effectiveMax),
  };

  const effectivePriceCents = selectedCut ? selectedCut.priceCents : product.priceCents;
  const prixAuKg = effectivePriceCents / 100;

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
          className={`relative w-[340px] max-w-[calc(100vw-32px)] overflow-hidden transition-all duration-300 ease-out bg-[#FAF8F5] dark:bg-[#1a1a1a] rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        >
          {/* ── Close button ── */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3.5 z-10 text-sm cursor-pointer text-[#C4B5A3] dark:text-neutral-500"
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* ── Header row: image + name + price/kg ── */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
            {/* Image square */}
            <div className="relative w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #1C1512, #3D261A)" }}
                >
                  <span className="text-3xl" style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))" }}>
                    🥩
                  </span>
                </div>
              )}
            </div>

            {/* Name + category */}
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-extrabold leading-tight truncate text-[#1C1512] dark:text-white font-serif">
                {product.name}
              </h2>
              <p className="mt-0.5 uppercase truncate text-[10px] text-[#C9A96E] tracking-[1.5px] font-serif">
                {product.category}
              </p>
            </div>

            {/* Price per kg */}
            <div className="flex-shrink-0 text-right">
              <span className="text-[22px] font-black text-[#DC2626] block leading-none">
                {prixAuKg.toFixed(2).replace(".", ",")} €
              </span>
              <span className="text-[11px] text-[#A08060] dark:text-neutral-500">/kg</span>
            </div>
          </div>

          {/* ── Badges ── */}
          {(product.origin || product.halalOrg || product.freshness) && (
            <div className="flex gap-1 px-3.5 mt-2 flex-wrap">
              {product.origin && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-[#DBEAFE] dark:border-blue-800">
                  {getFlag(product.origin)} {product.origin}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#FEF2F2] dark:bg-red-950/40 text-[#DC2626] dark:text-red-400 border border-[#FECACA] dark:border-red-800">
                  ☪ Halal {product.halalOrg}
                </span>
              )}
              {product.race && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#FFFBEB] dark:bg-amber-950/40 text-[#92400E] dark:text-amber-400 border border-[#FEF3C7] dark:border-amber-800">
                  🐄 {product.race}
                </span>
              )}
              {product.freshness && product.freshness !== "FRAIS" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#F0FDF4] dark:bg-green-950/40 text-[#16A34A] dark:text-green-400 border border-[#BBF7D0] dark:border-green-800">
                  {product.freshness === "SURGELE" ? "❄ Surgele" : product.freshness === "SOUS_VIDE" ? "🫙 Sous vide" : product.freshness}
                </span>
              )}
            </div>
          )}

          {/* ── Variant selector ── */}
          {product.variants && product.variants.length > 0 && (
            <div className="px-3.5 mt-2.5">
              <p className="text-[10px] font-bold text-[#A08060] dark:text-neutral-500 uppercase tracking-[1px] mb-1.5">Saveur</p>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map(v => (
                  <button key={v} type="button" onClick={() => setSelectedVariant(v === selectedVariant ? null : v)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${selectedVariant === v ? "bg-[#DC2626] text-white" : "bg-white/80 dark:bg-white/5 border border-[#ece8e3] dark:border-white/10 text-gray-700 dark:text-gray-300"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Cut options selector ── */}
          {product.cutOptions && product.cutOptions.length > 0 && (
            <div className="px-3.5 mt-2.5">
              <p className="text-[10px] font-bold text-[#A08060] dark:text-neutral-500 uppercase tracking-[1px] mb-1.5">Decoupe</p>
              <div className="space-y-1">
                {(product.cutOptions as Array<{ name: string; priceCents: number }>).map(opt => (
                  <button key={opt.name} type="button"
                    onClick={() => setSelectedCut(selectedCut?.name === opt.name ? null : opt)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      selectedCut?.name === opt.name
                        ? "bg-[#DC2626] text-white"
                        : "bg-white/80 dark:bg-white/5 border border-[#ece8e3] dark:border-white/10 text-gray-700 dark:text-gray-300"
                    }`}>
                    <span>{opt.name}</span>
                    <span>{(opt.priceCents / 100).toFixed(2).replace(".", ",")} {"\u20AC"}/kg</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Weight/Pieces toggle ── */}
          {product.weightPerPiece && product.weightPerPiece > 0 && (
            <div className="px-3.5 mt-2">
              <div className="flex bg-[#EDE8E2] dark:bg-white/5 rounded-lg p-0.5">
                <button type="button" onClick={() => setPieceMode(false)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${!pieceMode ? "bg-white dark:bg-[#2a2a2a] shadow-sm text-[#1C1512] dark:text-white" : "text-gray-500"}`}>
                  Au poids
                </button>
                <button type="button" onClick={() => setPieceMode(true)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${pieceMode ? "bg-white dark:bg-[#2a2a2a] shadow-sm text-[#1C1512] dark:text-white" : "text-gray-500"}`}>
                  Par pieces
                </button>
              </div>
            </div>
          )}

          {/* ── Weight selector OR Piece counter ── */}
          {pieceMode && product.weightPerPiece ? (
            <div className="px-3.5 pt-3 pb-1 space-y-2">
              <div className="flex items-center justify-center gap-4">
                <button type="button" onClick={() => setPieceCount(Math.max(1, pieceCount - 1))}
                  className="w-9 h-9 rounded-full bg-white dark:bg-white/5 border border-[#ece8e3] dark:border-white/10 flex items-center justify-center text-lg font-bold text-[#1C1512] dark:text-white">-</button>
                <div className="text-center">
                  <span className="text-2xl font-black text-[#1C1512] dark:text-white">{pieceCount}</span>
                  <span className="text-sm text-[#A08060] ml-1">{product.pieceLabel || "pieces"}</span>
                </div>
                <button type="button" onClick={() => setPieceCount(Math.min(50, pieceCount + 1))}
                  className="w-9 h-9 rounded-full bg-white dark:bg-white/5 border border-[#ece8e3] dark:border-white/10 flex items-center justify-center text-lg font-bold text-[#1C1512] dark:text-white">+</button>
              </div>
              <p className="text-center text-xs text-[#A08060] dark:text-neutral-500">
                ~{pieceCount * product.weightPerPiece}g &plusmn;{product.weightMargin || 15}%
              </p>
            </div>
          ) : (
            <div className="px-3.5 pt-3 pb-1">
              <QuantitySelector rule={effectiveRule} initialG={qty} onChange={setQty} compact />
            </div>
          )}

          {/* Weight tolerance note */}
          <div className="px-3.5 mt-1">
            <span className="inline-block px-2 py-1 rounded-md text-[10px] font-medium bg-[#FFFBEB] dark:bg-amber-950/30 text-[#92400E] dark:text-amber-400">
              ⚖️ &plusmn;{product.weightMargin || 10}% — ajustement au poids reel
            </span>
          </div>

          {/* ── CTA button ── */}
          <div className="px-3.5 pb-3.5 pt-2.5 mt-1">
            <button
              onClick={() => {
                const effectiveWeight = pieceMode && product.weightPerPiece ? pieceCount * product.weightPerPiece : qty;
                onConfirm(effectiveWeight, {
                  variant: selectedVariant || undefined,
                  pieceCount: pieceMode && product.weightPerPiece ? pieceCount : undefined,
                  pieceLabel: pieceMode && product.weightPerPiece ? (product.pieceLabel || undefined) : undefined,
                  cutOption: selectedCut?.name,
                  cutPriceCents: selectedCut?.priceCents,
                });
              }}
              className="w-full h-10 rounded-[10px] flex items-center justify-center gap-2 text-white text-sm font-extrabold active:scale-[0.97] transition-transform bg-[#DC2626] shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
            >
              Ajouter
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-[13px] font-black">
                {formatPrice(computePrice(pieceMode && product.weightPerPiece ? pieceCount * product.weightPerPiece : qty, prixAuKg))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
