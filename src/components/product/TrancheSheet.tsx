// src/components/product/TrancheSheet.tsx — Floating card for TRANCHE products (slice selector)
"use client";

import { useState, useCallback, useEffect } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { ChevronDown } from "lucide-react";
import { getFlag } from "@/lib/flags";
import { formatGrams } from "@/lib/pricing/format";
import { portionPriceCents } from "@/lib/pricing/line";
import {
  DEFAULT_SLICE_OPTIONS,
  SLICE_GRAMS,
  sliceWeightGrams,
  type SliceThickness,
} from "@/lib/pricing/preparation";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { formatPrice } from "@/lib/utils";

// ── Thickness config ──────────────────────────────
// Weight of one slice: SLICE_GRAMS of src/lib/pricing/preparation.ts, the table the server checks
// the ordered weight against.

const THICKNESS_CONFIG = {
  chiffonnade: { label: "Chiffonnade", weightG: SLICE_GRAMS.chiffonnade, emoji: "🪶" },
  fine: { label: "Fine", weightG: SLICE_GRAMS.fine, emoji: "🔪" },
  moyenne: { label: "Moyenne", weightG: SLICE_GRAMS.moyenne, emoji: "🥩" },
  normale: { label: "Normale", weightG: SLICE_GRAMS.normale, emoji: "🥩" },
  epaisse: { label: "Épaisse", weightG: SLICE_GRAMS.epaisse, emoji: "🍖" },
} as const satisfies Record<SliceThickness, { label: string; weightG: number; emoji: string }>;

export type ThicknessKey = SliceThickness;

export interface SliceOptions {
  defaultSlices: number;
  minSlices: number;
  maxSlices: number;
  thicknesses: ThicknessKey[];
}

export interface TrancheSheetProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  /** Pricing columns of the product (see ProductPricing); per kilogram. */
  priceCents: number;
  promoPct?: number | null;
  promoType?: string | null;
  promoEnd?: string | null;
  promoFixedCents?: number | null;
  /** When the sheet was opened: the displayed prices are resolved at that time. */
  pricedAt: Date;
  origin?: string | null;
  halalOrg?: string | null;
  race?: string | null;
  freshness?: string | null;
  originRegion?: string | null;
  raceDescription?: string | null;
  elevageMode?: string | null;
  elevageDetail?: string | null;
  halalMethod?: string | null;
  freshDate?: string | null;
  freshDetail?: string | null;
  sliceOptions: SliceOptions | null;
}

interface Props {
  product: TrancheSheetProduct | null;
  onConfirm: (sliceCount: number, thickness: ThicknessKey, estimatedWeightG: number) => void;
  onClose: () => void;
}

const PRESET_SLICES = [2, 4, 6, 8, 10, 12];

export function TrancheSheet({ product, onConfirm, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [sliceCount, setSliceCount] = useState(6);
  const [thickness, setThickness] = useState<ThicknessKey>("fine");
  const [showFiche, setShowFiche] = useState(false);

  const opts = product?.sliceOptions;
  const availableThicknesses: ThicknessKey[] = opts?.thicknesses?.length
    ? opts.thicknesses
    : DEFAULT_SLICE_OPTIONS.thicknesses;

  // Reset state when product changes
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const defaultSlices = opts?.defaultSlices ?? DEFAULT_SLICE_OPTIONS.defaultSlices;
    setSliceCount(defaultSlices);
    // Pick first available thickness or "normale"
    const defaultThickness = availableThicknesses.includes("normale")
      ? "normale"
      : (availableThicknesses[0] ?? "normale");
    setThickness(defaultThickness);
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

  if (!product) return null;

  const estimatedWeightG = sliceWeightGrams(sliceCount, thickness);
  const price = resolveUnitPrice(product, { isPro: false, now: product.pricedAt });
  if (!price.ok)
    throw new Error(`resolveUnitPrice refused product ${product.id} without cut option`);
  const estimatedPriceCents = portionPriceCents(price.unitPriceCents, estimatedWeightG);

  const minSlices = opts?.minSlices ?? DEFAULT_SLICE_OPTIONS.minSlices;
  const maxSlices = opts?.maxSlices ?? DEFAULT_SLICE_OPTIONS.maxSlices;

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
          className={`relative max-h-[calc(100vh-32px)] w-[340px] max-w-[calc(100vw-32px)] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          style={{
            background: "#FAF8F5",
            borderRadius: "20px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-3.5 top-3 z-10 cursor-pointer text-sm"
            style={{ color: "#C4B5A3" }}
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* Header: image + name + price/kg */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl">
              {product.imageUrl ? (
                <SafeImage
                  type="product"
                  src={product.imageUrl}
                  alt={product.name}
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
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
                    🔪
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2
                className="truncate text-[15px] font-extrabold leading-tight"
                style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
              >
                {product.name}
              </h2>
              <p
                className="mt-0.5 truncate uppercase"
                style={{
                  fontSize: "10px",
                  color: "#C9A96E",
                  letterSpacing: "1.5px",
                  fontFamily: "Georgia, serif",
                }}
              >
                {product.category}
              </p>
            </div>

            <div className="flex-shrink-0 text-right">
              <span className="block text-[22px] font-black leading-none text-[#DC2626]">
                {formatPrice(price.unitPriceCents)}
              </span>
              <span className="text-[11px]" style={{ color: "#A08060" }}>
                /kg
              </span>
            </div>
          </div>

          {/* Badges */}
          {(product.origin || product.halalOrg) && (
            <div className="mt-2 flex flex-wrap gap-1 px-3.5">
              {product.origin && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#DBEAFE] bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-bold text-[#2563EB]">
                  {getFlag(product.origin)} {product.origin}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                  ☪ Halal {product.halalOrg}
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
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
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
                <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">
                  Fiche Confiance — Tracabilite
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#16A34A] transition-transform ${showFiche ? "rotate-180" : ""}`}
                />
              </button>

              {showFiche && (
                <div
                  className="mt-1.5 space-y-1.5 rounded-lg px-2.5 py-2"
                  style={{ background: "#F7FDF9", border: "1px solid #D1FAE5" }}
                >
                  {product.originRegion && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">📍</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534]">Region</p>
                        <p className="text-[11px] text-[#1C1512]">
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
                        <p className="text-[11px] font-bold uppercase text-[#166534]">
                          Race{product.race ? ` — ${product.race}` : ""}
                        </p>
                        <p className="text-[11px] text-[#1C1512]">{product.raceDescription}</p>
                      </div>
                    </div>
                  )}
                  {product.elevageMode && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">🌿</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534]">Elevage</p>
                        <p className="text-[11px] text-[#1C1512]">
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
                        <p className="text-[11px] font-bold uppercase text-[#166534]">
                          Abattage halal
                        </p>
                        <p className="text-[11px] text-[#1C1512]">{product.halalMethod}</p>
                      </div>
                    </div>
                  )}
                  {(product.freshDate || product.freshDetail) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">❄</span>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[#166534]">Fraicheur</p>
                        <p className="text-[11px] text-[#1C1512]">
                          {product.freshDetail || ""}
                          {product.freshDate && (
                            <span className="text-[10px] text-[#6B7280]">
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

          {/* Slice count selector */}
          <div className="px-3.5 pt-3">
            <p
              className="mb-2 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "#A08060" }}
            >
              Nombre de tranches
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SLICES.filter((n) => n >= minSlices && n <= maxSlices).map((n) => (
                <button
                  key={n}
                  onClick={() => setSliceCount(n)}
                  className={`h-10 w-10 rounded-xl text-sm font-bold transition-all ${
                    sliceCount === n
                      ? "bg-[#DC2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                      : "border border-gray-200 bg-white text-gray-700 hover:border-[#DC2626]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {/* Custom input if needed */}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setSliceCount(Math.max(minSlices, sliceCount - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
              >
                −
              </button>
              <span className="min-w-[40px] text-center text-lg font-black tabular-nums text-[#1C1512]">
                {sliceCount}
              </span>
              <button
                onClick={() => setSliceCount(Math.min(maxSlices, sliceCount + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
              >
                +
              </button>
            </div>
          </div>

          {/* Thickness selector */}
          <div className="px-3.5 pt-3">
            <p
              className="mb-2 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "#A08060" }}
            >
              Épaisseur
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableThicknesses.map((t) => {
                const cfg = THICKNESS_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setThickness(t)}
                    className={`flex items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-bold transition-all ${
                      thickness === t
                        ? "bg-[#DC2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-[#DC2626]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weight estimate */}
          <div className="mt-3 px-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: "#A08060" }}>
                Poids estime
              </span>
              <span className="text-sm font-bold text-[#1C1512]">
                ~{formatGrams(estimatedWeightG)}
              </span>
            </div>
            <span
              className="mt-1 inline-block rounded-md px-2 py-1 text-[10px] font-medium"
              style={{ background: "#FFFBEB", color: "#92400E" }}
            >
              ⚖️ Prix estime — ajuste apres pesee
            </span>
          </div>

          {/* CTA button */}
          <div className="mt-1 px-3.5 pb-3.5 pt-2.5">
            <button
              onClick={() => onConfirm(sliceCount, thickness, estimatedWeightG)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-extrabold text-white transition-transform active:scale-[0.97]"
              style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
            >
              Ajouter
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[13px] font-black">
                {formatPrice(estimatedPriceCents)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
