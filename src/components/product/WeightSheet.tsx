// src/components/product/WeightSheet.tsx — V2 weight selection sheet
"use client";

import { useState } from "react";
import Image from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { getConversionRule } from "@/lib/conversion-config";
import { computePrice, formatPrice } from "@/lib/estimate";
import { getFlag, getOriginCountry } from "@/lib/flags";

export interface WeightSheetProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: string;
  priceCents: number;
  // V2 fields
  minWeightG?: number | null;
  weightStepG?: number | null;
  maxWeightG?: number | null;
  origin?: string | null;
  halalOrg?: string | null;
  race?: string | null;
  freshness?: string | null;
}

interface Props {
  product: WeightSheetProduct | null;
  onConfirm: (weightG: number) => void;
  onClose: () => void;
}

export function WeightSheet({ product, onConfirm, onClose }: Props) {
  const rule = product ? getConversionRule(product.category) : null;

  // Use product-specific weight settings if available, otherwise fall back to conversion rule
  const effectiveMin = product?.minWeightG ?? rule?.minG ?? 100;
  const effectiveStep = product?.weightStepG ?? rule?.pasG ?? 50;
  const effectiveMax = product?.maxWeightG ?? rule?.maxG ?? 5000;

  const defaultG = rule ? (rule.presetsG[1] ?? rule.presetsG[0] ?? effectiveMin) : 500;
  const [qty, setQty] = useState(defaultG);

  // Reset qty when product changes
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const r = getConversionRule(product.category);
    const d = r.presetsG[1] ?? r.presetsG[0] ?? (product.minWeightG ?? r.minG);
    setQty(d);
  }

  if (!product || !rule) return null;

  // Override rule with product-specific values
  const effectiveRule = {
    ...rule,
    minG: effectiveMin,
    pasG: effectiveStep,
    maxG: effectiveMax,
  };

  const prixAuKg = product.priceCents / 100;
  const prix = computePrice(qty, prixAuKg);
  const prixKgFormate = prixAuKg.toFixed(2).replace(".", ",") + " \u20AC";

  return (
    <Sheet open={product !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-[12px] overflow-hidden shrink-0">
              <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wider">{product.category}</span>
              <SheetTitle>{product.name}</SheetTitle>
              <SheetDescription>{product.description}</SheetDescription>
            </div>
          </div>

          {/* V2: Origin & Halal info */}
          {(product.origin || product.halalOrg || product.freshness) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {product.origin && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                  {getFlag(product.origin)} {getOriginCountry(product.origin)}
                  {product.race && <span className="text-blue-500">({product.race})</span>}
                </span>
              )}
              {product.halalOrg && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  ☪ {product.halalOrg}
                </span>
              )}
              {product.freshness && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-lg text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  {product.freshness}
                </span>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Price per kg */}
        <div className="flex items-center gap-2 mt-4 mb-4">
          <span className="text-base font-extrabold text-gray-900 dark:text-white">{prixKgFormate}</span>
          <span className="text-[11px] font-semibold text-gray-400">/kg</span>
        </div>

        {/* Quantity selector */}
        <QuantitySelector rule={effectiveRule} initialG={defaultG} onChange={setQty} compact />

        {/* Weight tolerance info */}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          Poids indicatif \u00B1 10% — ajustement au poids réel
        </p>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(qty)}
          className="mt-4 w-full py-3 rounded-2xl bg-[#DC2626] text-white text-sm font-semibold transition-all hover:bg-[#b91c1c] shadow-md active:scale-[0.98]"
        >
          Ajouter — {formatPrice(prix)}
        </button>
      </SheetContent>
    </Sheet>
  );
}
