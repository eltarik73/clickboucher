// src/components/product/QuantityPicker.tsx
"use client";

import { useState, useCallback } from "react";
import { getConversionRule } from "@/lib/conversion-config";
import { computeEstimation, formatEstimation, formatWeight } from "@/lib/estimate";

interface Props {
  category: string;
  prixAuKg: number;
  initialG?: number;
  onChange: (g: number) => void;
}

export function QuantityPicker({ category, prixAuKg, initialG, onChange }: Props) {
  const rule = getConversionRule(category);
  const defaultG = initialG ?? rule.presetsG[1] ?? rule.presetsG[0] ?? rule.minG;
  const [qty, setQty] = useState(defaultG);
  const [activePreset, setActivePreset] = useState<number | null>(rule.presetsG.includes(defaultG) ? defaultG : null);

  const update = useCallback((v: number) => {
    const clamped = Math.max(rule.minG, Math.min(rule.maxG, v));
    setQty(clamped);
    onChange(clamped);
    setActivePreset(rule.presetsG.includes(clamped) ? clamped : null);
  }, [rule, onChange]);

  const est = computeEstimation(qty, category);
  const estText = formatEstimation(est);
  const price = (qty / 1000) * prixAuKg;

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {rule.presetsG.map(p => (
          <button key={p} type="button" onClick={() => update(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${activePreset === p
                ? "bg-[#DC2626] text-white shadow-sm"
                : "bg-[#F5F3F0] text-[#6B6560] hover:bg-[#EBE8E4]"
              }`}>
            {formatWeight(p)}
          </button>
        ))}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => update(qty - rule.pasG)} disabled={qty <= rule.minG}
          className="w-10 h-10 rounded-xl bg-[#F5F3F0] flex items-center justify-center text-lg font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-30 transition-all active:scale-95">
          -
        </button>
        <div className="flex-1 relative">
          <input type="number" value={qty} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) update(v); }}
            min={rule.minG} max={rule.maxG} step={rule.pasG}
            className="w-full text-center text-lg font-semibold py-2.5 border border-[#E8E5E1] rounded-xl
              focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9C9590]">g</span>
        </div>
        <button type="button" onClick={() => update(qty + rule.pasG)} disabled={qty >= rule.maxG}
          className="w-10 h-10 rounded-xl bg-[#F5F3F0] flex items-center justify-center text-lg font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-30 transition-all active:scale-95">
          +
        </button>
      </div>

      {/* Estimation microcopy */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FEF8F0] border border-[#F5E6D0]">
        <div className="flex items-center gap-2 text-sm text-[#B45309]">
          <span>&#x1F4A1;</span>
          <span>{estText}</span>
        </div>
        <span className="text-sm font-semibold text-[#1A1A1A]">{price.toFixed(2)}&euro;</span>
      </div>
    </div>
  );
}
