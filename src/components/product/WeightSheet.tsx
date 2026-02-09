"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { getConversionRule } from "@/lib/conversion-config";
import { computePrice, formatPrice } from "@/lib/estimate";

export interface WeightSheetProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: string;
  priceCents: number;
  minWeight?: number;
}

interface Props {
  product: WeightSheetProduct | null;
  onConfirm: (weightG: number) => void;
  onClose: () => void;
}

export function WeightSheet({ product, onConfirm, onClose }: Props) {
  const rule = product ? getConversionRule(product.category) : null;
  const defaultG = rule ? (rule.presetsG[1] ?? rule.presetsG[0] ?? rule.minG) : 500;
  const [qty, setQty] = useState(defaultG);

  // Reset qty when product changes
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    const r = getConversionRule(product.category);
    const d = r.presetsG[1] ?? r.presetsG[0] ?? r.minG;
    setQty(d);
  }

  if (!product || !rule) return null;

  const prixAuKg = product.priceCents / 100;
  const prix = computePrice(qty, prixAuKg);
  const prixKgFormate = prixAuKg.toFixed(2).replace(".", ",") + " \u20AC";

  return (
    <Sheet open={product !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-[12px] overflow-hidden shrink-0">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wider">{product.category}</span>
              <SheetTitle>{product.name}</SheetTitle>
              <SheetDescription>{product.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Price per kg */}
        <div className="flex items-center gap-2 mt-4 mb-4">
          <span className="text-base font-extrabold text-[#2a2018]">{prixKgFormate}</span>
          <span className="text-[11px] font-semibold text-[#bbb]">/kg</span>
        </div>

        {/* Quantity selector */}
        <QuantitySelector rule={rule} initialG={defaultG} onChange={setQty} compact />

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(qty)}
          className="mt-4 w-full py-3 rounded-2xl bg-[#DC2626] text-white text-sm font-semibold transition-all hover:bg-[#6e1d00] shadow-md"
        >
          Ajouter — {formatPrice(prix)}
        </button>
      </SheetContent>
    </Sheet>
  );
}
