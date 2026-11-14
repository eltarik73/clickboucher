// src/components/product/WeightSheet.tsx — F1 Fusion floating mini card for weight products
"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { getConversionRule } from "@/lib/conversion-config";
import { getFlag } from "@/lib/flags";
import { portionPriceCents } from "@/lib/pricing/line";
import { pricedCutOptions, resolveUnitPrice } from "@/lib/pricing/unit-price";
import { formatPrice } from "@/lib/utils";

export interface WeightSheetProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: string;
  /** Pricing columns of the product (see ProductPricing); per kilogram. */
  priceCents: number;
  promoPct?: number | null;
  promoType?: string | null;
  promoEnd?: string | null;
  promoFixedCents?: number | null;
  /** When the sheet was opened: the displayed prices are resolved at that time. */
  pricedAt: Date;
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
  originRegion?: string | null;
  raceDescription?: string | null;
  elevageMode?: string | null;
  elevageDetail?: string | null;
  halalMethod?: string | null;
  freshDate?: string | null;
  freshDetail?: string | null;
}

/** What the customer chose. The cut option is a NAME: its price is resolved from the product. */
export interface WeightSelection {
  variant?: string;
  pieceCount?: number;
  pieceLabel?: string;
  cutOption?: string;
}

interface Props {
  product: WeightSheetProduct | null;
  onConfirm: (weightG: number, selection: WeightSelection) => void;
  onClose: () => void;
}

/** Unit price per kilogram of `product` with `cutOption`, at the time the sheet was opened. */
function pricePerKgCents(product: WeightSheetProduct, cutOption: string | null): number {
  const price = resolveUnitPrice(product, { isPro: false, cutOption, now: product.pricedAt });
  if (!price.ok)
    throw new Error(`Cut option "${cutOption}" refused for product ${product.id}: ${price.error}`);
  return price.unitPriceCents;
}

export function WeightSheet({ product, onConfirm, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(500);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedCut, setSelectedCut] = useState<string | null>(null);
  const [showFiche, setShowFiche] = useState(false);
  const [imgError, setImgError] = useState(false);
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
    const d = r.presetsG[1] ?? r.presetsG[0] ?? product.minWeightG ?? r.minG;
    setQty(d);
    setSelectedVariant(null);
    setSelectedCut(null);
    setImgError(false);
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

  // Only priced cuts are offered: one stored at 0 would be refused by the server.
  const cutOptions = pricedCutOptions(product.cutOptions);
  // The selection of a previously opened product is reset during this render: only a cut of
  // this product is priced.
  const activeCut = cutOptions.some((opt) => opt.name === selectedCut) ? selectedCut : null;
  const unitPriceCents = pricePerKgCents(product, activeCut);
  const portionGrams =
    pieceMode && product.weightPerPiece ? pieceCount * product.weightPerPiece : qty;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={handleClose}
      >
        {/* Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative max-h-[calc(100vh-32px)] w-[340px] max-w-[calc(100vw-32px)] overflow-y-auto overflow-x-hidden rounded-[20px] bg-[#FAF8F5] shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out dark:bg-[#1a1a1a] ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        >
          {/* ── Close button ── */}
          <button
            onClick={handleClose}
            className="absolute right-3.5 top-3 z-10 cursor-pointer text-sm text-[#C4B5A3] dark:text-neutral-500"
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* ── Header row: image + name + price/kg ── */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
            {/* Image square */}
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl">
              {product.imageUrl && !imgError ? (
                <Image
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
                  <span
                    className="text-3xl"
                    style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))" }}
                  >
                    🥩
                  </span>
                </div>
              )}
            </div>

            {/* Name + category */}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-serif text-[15px] font-extrabold leading-tight text-[#1C1512] dark:text-white">
                {product.name}
              </h2>
              <p className="mt-0.5 truncate font-serif text-[10px] uppercase tracking-[1.5px] text-[#C9A96E]">
                {product.category}
              </p>
            </div>

            {/* Price per kg */}
            <div className="flex-shrink-0 text-right">
              <span className="block text-[22px] font-black leading-none text-[#DC2626]">
                {formatPrice(unitPriceCents)}
              </span>
              <span className="text-[11px] text-[#A08060] dark:text-neutral-500">/kg</span>
            </div>
          </div>

          {/* ── Badges ── */}
          {(product.origin || product.halalOrg || product.freshness) && (
            <div className="mt-2 flex flex-wrap gap-1 px-3.5">
              {product.origin && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#DBEAFE] bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-bold text-[#2563EB] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                  {getFlag(product.origin)} {product.origin}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[11px] font-bold text-[#DC2626] dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                  ☪ Halal {product.halalOrg}
                </span>
              )}
              {product.race && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#FEF3C7] bg-[#FFFBEB] px-1.5 py-0.5 text-[11px] font-bold text-[#92400E] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                  🐄 {product.race}
                </span>
              )}
              {product.freshness && product.freshness !== "FRAIS" && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#BBF7D0] bg-[#F0FDF4] px-1.5 py-0.5 text-[11px] font-bold text-[#16A34A] dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                  {product.freshness === "SURGELE"
                    ? "❄ Surgele"
                    : product.freshness === "SOUS_VIDE"
                      ? "🫙 Sous vide"
                      : product.freshness}
                </span>
              )}
            </div>
          )}

          {/* ── Fiche Confiance teaser ── */}
          {(product.originRegion ||
            product.elevageMode ||
            product.raceDescription ||
            product.halalMethod ||
            product.freshDetail) && (
            <div className="mt-2 px-3.5">
              <button
                type="button"
                onClick={() => setShowFiche(!showFiche)}
                className="flex w-full items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-2 text-left transition-colors dark:border-green-800 dark:bg-green-950/30"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="2.5"
                  className="flex-shrink-0"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-[#16A34A] dark:text-green-400">
                  Fiche Confiance — Tracabilite
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#16A34A] transition-transform dark:text-green-400 ${showFiche ? "rotate-180" : ""}`}
                />
              </button>

              {showFiche && (
                <div className="mt-1.5 space-y-1.5 rounded-lg border border-[#D1FAE5] bg-[#F7FDF9] px-2.5 py-2 dark:border-green-800/50 dark:bg-green-950/20">
                  {product.originRegion && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">📍</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534] dark:text-green-400">
                          Region
                        </p>
                        <p className="text-[11px] text-[#1C1512] dark:text-white">
                          {product.originRegion}
                          {product.origin ? ` (${product.origin})` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                  {product.raceDescription && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">🐄</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534] dark:text-green-400">
                          Race{product.race ? ` — ${product.race}` : ""}
                        </p>
                        <p className="text-[11px] text-[#1C1512] dark:text-white">
                          {product.raceDescription}
                        </p>
                      </div>
                    </div>
                  )}
                  {product.elevageMode && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">🌿</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534] dark:text-green-400">
                          Elevage
                        </p>
                        <p className="text-[11px] text-[#1C1512] dark:text-white">
                          {product.elevageMode
                            .replace(/_/g, " ")
                            .toLowerCase()
                            .replace(/^\w/, (c) => c.toUpperCase())}
                          {product.elevageDetail ? ` — ${product.elevageDetail}` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                  {product.halalMethod && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">☪</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534] dark:text-green-400">
                          Abattage halal
                        </p>
                        <p className="text-[11px] text-[#1C1512] dark:text-white">
                          {product.halalMethod}
                        </p>
                      </div>
                    </div>
                  )}
                  {(product.freshDate || product.freshDetail) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">❄</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534] dark:text-green-400">
                          Fraicheur
                        </p>
                        <p className="text-[11px] text-[#1C1512] dark:text-white">
                          {product.freshDetail || ""}
                          {product.freshDate && (
                            <span className="text-[10px] text-[#6B7280] dark:text-neutral-500">
                              {" "}
                              — {new Date(product.freshDate).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Variant selector ── */}
          {product.variants && product.variants.length > 0 && (
            <div className="mt-2.5 px-3.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[1px] text-[#A08060] dark:text-neutral-500">
                Saveur
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVariant(v === selectedVariant ? null : v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${selectedVariant === v ? "bg-[#DC2626] text-white" : "border border-[#ece8e3] bg-white/80 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Cut options selector ── */}
          {cutOptions.length > 0 && (
            <div className="mt-2.5 px-3.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[1px] text-[#A08060] dark:text-neutral-500">
                Découpe
              </p>
              <div className="space-y-1">
                {cutOptions.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setSelectedCut(activeCut === opt.name ? null : opt.name)}
                    className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      activeCut === opt.name
                        ? "bg-[#DC2626] text-white"
                        : "border border-[#ece8e3] bg-white/80 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                    }`}
                  >
                    <span>{opt.name}</span>
                    <span>{formatPrice(pricePerKgCents(product, opt.name))}/kg</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Weight/Pieces toggle ── */}
          {product.weightPerPiece && product.weightPerPiece > 0 && (
            <div className="mt-2 px-3.5">
              <div className="flex rounded-lg bg-[#EDE8E2] p-0.5 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setPieceMode(false)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${!pieceMode ? "bg-white text-[#1C1512] shadow-sm dark:bg-[#2a2a2a] dark:text-white" : "text-gray-500"}`}
                >
                  Au poids
                </button>
                <button
                  type="button"
                  onClick={() => setPieceMode(true)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${pieceMode ? "bg-white text-[#1C1512] shadow-sm dark:bg-[#2a2a2a] dark:text-white" : "text-gray-500"}`}
                >
                  Par pieces
                </button>
              </div>
            </div>
          )}

          {/* ── Weight selector OR Piece counter ── */}
          {pieceMode && product.weightPerPiece ? (
            <div className="space-y-2 px-3.5 pb-1 pt-3">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setPieceCount(Math.max(1, pieceCount - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ece8e3] bg-white text-lg font-bold text-[#1C1512] dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  -
                </button>
                <div className="text-center">
                  <span className="text-2xl font-black text-[#1C1512] dark:text-white">
                    {pieceCount}
                  </span>
                  <span className="ml-1 text-sm text-[#A08060]">
                    {product.pieceLabel || "pieces"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPieceCount(Math.min(50, pieceCount + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ece8e3] bg-white text-lg font-bold text-[#1C1512] dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  +
                </button>
              </div>
              <p className="text-center text-xs text-[#A08060] dark:text-neutral-500">
                ~{pieceCount * product.weightPerPiece}g &plusmn;{product.weightMargin || 15}%
              </p>
            </div>
          ) : (
            <div className="px-3.5 pb-1 pt-3">
              <QuantitySelector rule={effectiveRule} initialG={qty} onChange={setQty} compact />
            </div>
          )}

          {/* Weight tolerance note */}
          <div className="mt-1 px-3.5">
            <span className="inline-block rounded-md bg-[#FFFBEB] px-2 py-1 text-[10px] font-medium text-[#92400E] dark:bg-amber-950/30 dark:text-amber-400">
              ⚖️ &plusmn;{product.weightMargin || 10}% — ajustement au poids reel
            </span>
          </div>

          {/* ── CTA button ── */}
          <div className="mt-1 px-3.5 pb-3.5 pt-2.5">
            <button
              onClick={() => {
                onConfirm(portionGrams, {
                  variant: selectedVariant || undefined,
                  pieceCount: pieceMode && product.weightPerPiece ? pieceCount : undefined,
                  pieceLabel:
                    pieceMode && product.weightPerPiece
                      ? product.pieceLabel || undefined
                      : undefined,
                  cutOption: activeCut ?? undefined,
                });
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#DC2626] text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(220,38,38,0.2)] transition-transform active:scale-[0.97]"
            >
              Ajouter
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[13px] font-black">
                {formatPrice(portionPriceCents(unitPriceCents, portionGrams))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
