// src/components/product/TrancheSheet.tsx — Floating card for TRANCHE products (slice selector)
"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/estimate";
import { getFlag } from "@/lib/flags";

// ── Thickness config ──────────────────────────────

const THICKNESS_CONFIG = {
  chiffonnade: { label: "Chiffonnade", weightG: 15, emoji: "🪶" },
  fine: { label: "Fine", weightG: 30, emoji: "🔪" },
  moyenne: { label: "Moyenne", weightG: 50, emoji: "🥩" },
  normale: { label: "Normale", weightG: 50, emoji: "🥩" },
  epaisse: { label: "Épaisse", weightG: 60, emoji: "🍖" },
} as const;

export type ThicknessKey = keyof typeof THICKNESS_CONFIG;

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
  priceCents: number; // price per kg
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
    : ["chiffonnade", "fine", "moyenne"];

  // Reset state when product changes
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const defaultSlices = opts?.defaultSlices ?? 6;
    setSliceCount(defaultSlices);
    // Pick first available thickness or "normale"
    const defaultThickness = availableThicknesses.includes("normale")
      ? "normale"
      : availableThicknesses[0] ?? "normale";
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

  const thicknessWeightG = THICKNESS_CONFIG[thickness].weightG;
  const estimatedWeightG = sliceCount * thicknessWeightG;
  const prixAuKg = product.priceCents / 100;
  const estimatedPrice = Math.round((estimatedWeightG / 1000) * prixAuKg * 100) / 100;

  const minSlices = opts?.minSlices ?? 1;
  const maxSlices = opts?.maxSlices ?? 20;

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
          className={`relative w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          style={{
            background: "#FAF8F5",
            borderRadius: "20px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3.5 z-10 text-sm cursor-pointer"
            style={{ color: "#C4B5A3" }}
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* Header: image + name + price/kg */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
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
                    🔪
                  </span>
                </div>
              )}
            </div>

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
                {product.category}
              </p>
            </div>

            <div className="flex-shrink-0 text-right">
              <span className="text-[22px] font-black text-[#DC2626] block leading-none">
                {prixAuKg.toFixed(2).replace(".", ",")} €
              </span>
              <span className="text-[11px]" style={{ color: "#A08060" }}>/kg</span>
            </div>
          </div>

          {/* Badges */}
          {(product.origin || product.halalOrg) && (
            <div className="flex gap-1 px-3.5 mt-2 flex-wrap">
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
            </div>
          )}

          {/* ── Fiche Confiance teaser ── */}
          {(product.originRegion || product.elevageMode || product.raceDescription || product.halalMethod || product.freshDetail) && (
            <div className="px-3.5 mt-2">
              <button
                type="button"
                onClick={() => setShowFiche(!showFiche)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span className="flex-1 text-[10px] font-bold text-[#16A34A] uppercase tracking-wide">Fiche Confiance — Tracabilite</span>
                <ChevronDown size={14} className={`text-[#16A34A] transition-transform ${showFiche ? "rotate-180" : ""}`} />
              </button>

              {showFiche && (
                <div className="mt-1.5 px-2.5 py-2 rounded-lg space-y-1.5" style={{ background: "#F7FDF9", border: "1px solid #D1FAE5" }}>
                  {product.originRegion && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">📍</span>
                      <div>
                        <p className="text-[9px] font-bold text-[#166534] uppercase">Region</p>
                        <p className="text-[11px] text-[#1C1512]">{product.originRegion}{product.origin ? ` (${product.origin})` : ""}</p>
                      </div>
                    </div>
                  )}
                  {product.raceDescription && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">🐄</span>
                      <div>
                        <p className="text-[9px] font-bold text-[#166534] uppercase">Race{product.race ? ` — ${product.race}` : ""}</p>
                        <p className="text-[11px] text-[#1C1512]">{product.raceDescription}</p>
                      </div>
                    </div>
                  )}
                  {product.elevageMode && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">🌿</span>
                      <div>
                        <p className="text-[9px] font-bold text-[#166534] uppercase">Elevage</p>
                        <p className="text-[11px] text-[#1C1512]">{product.elevageMode.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}{product.elevageDetail ? ` — ${product.elevageDetail}` : ""}</p>
                      </div>
                    </div>
                  )}
                  {product.halalMethod && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">☪</span>
                      <div>
                        <p className="text-[9px] font-bold text-[#166534] uppercase">Abattage halal</p>
                        <p className="text-[11px] text-[#1C1512]">{product.halalMethod}</p>
                      </div>
                    </div>
                  )}
                  {(product.freshDate || product.freshDetail) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px]">❄</span>
                      <div>
                        <p className="text-[9px] font-bold text-[#166534] uppercase">Fraicheur</p>
                        <p className="text-[11px] text-[#1C1512]">
                          {product.freshDetail || ""}
                          {product.freshDate && <span className="text-[10px] text-[#6B7280]"> — {new Date(product.freshDate).toLocaleDateString("fr-FR")}</span>}
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
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#A08060" }}>
              Nombre de tranches
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_SLICES.filter(n => n >= minSlices && n <= maxSlices).map((n) => (
                <button
                  key={n}
                  onClick={() => setSliceCount(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                    sliceCount === n
                      ? "bg-[#DC2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-[#DC2626]/40"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {/* Custom input if needed */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setSliceCount(Math.max(minSlices, sliceCount - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-lg font-bold hover:bg-gray-200 transition-colors"
              >
                −
              </button>
              <span className="text-lg font-black text-[#1C1512] min-w-[40px] text-center tabular-nums">
                {sliceCount}
              </span>
              <button
                onClick={() => setSliceCount(Math.min(maxSlices, sliceCount + 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-lg font-bold hover:bg-gray-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Thickness selector */}
          <div className="px-3.5 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#A08060" }}>
              Épaisseur
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {availableThicknesses.map((t) => {
                const cfg = THICKNESS_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setThickness(t)}
                    className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1 ${
                      thickness === t
                        ? "bg-[#DC2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-[#DC2626]/40"
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
          <div className="px-3.5 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: "#A08060" }}>
                Poids estime
              </span>
              <span className="text-sm font-bold text-[#1C1512]">
                ~{estimatedWeightG >= 1000 ? `${(estimatedWeightG / 1000).toFixed(1).replace(".", ",")} kg` : `${estimatedWeightG} g`}
              </span>
            </div>
            <span
              className="inline-block px-2 py-1 rounded-md text-[10px] font-medium mt-1"
              style={{ background: "#FFFBEB", color: "#92400E" }}
            >
              ⚖️ Prix estime — ajuste apres pesee
            </span>
          </div>

          {/* CTA button */}
          <div className="px-3.5 pb-3.5 pt-2.5 mt-1">
            <button
              onClick={() => onConfirm(sliceCount, thickness, estimatedWeightG)}
              className="w-full h-10 rounded-[10px] flex items-center justify-center gap-2 text-white text-sm font-extrabold active:scale-[0.97] transition-transform"
              style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
            >
              Ajouter
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-[13px] font-black">
                {formatPrice(estimatedPrice)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
