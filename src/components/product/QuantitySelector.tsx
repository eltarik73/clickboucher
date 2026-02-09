// src/components/product/QuantitySelector.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { type ConversionRule } from "@/lib/conversion-config";
import { computeEstimation, formatEstimation, formatWeight } from "@/lib/estimate";

interface Props {
  rule: ConversionRule;
  initialG?: number;
  onChange: (g: number) => void;
  compact?: boolean;
}

export function QuantitySelector({ rule, initialG, onChange, compact = false }: Props) {
  const def = initialG ?? rule.presetsG[1] ?? rule.presetsG[0] ?? rule.minG;
  const [qty, setQty] = useState(def);
  const [activePreset, setActivePreset] = useState<number | null>(rule.presetsG.includes(def) ? def : null);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useCallback((v: number) => {
    const c = Math.max(rule.minG, Math.min(rule.maxG, v));
    setQty(c);
    onChange(c);
    setActivePreset(rule.presetsG.includes(c) ? c : null);
  }, [rule, onChange]);

  const est = computeEstimation(qty, rule.category);
  const estText = formatEstimation(est);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {rule.presetsG.map(p => (
          <button key={p} type="button" onClick={() => update(p)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200
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
          className="w-8 h-8 rounded-lg bg-[#F5F3F0] flex items-center justify-center text-sm font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-25 transition-all active:scale-90">
          −
        </button>
        <div className="flex-1 relative">
          <input ref={inputRef} type="number" value={qty} onChange={e => {const v=parseInt(e.target.value);if(!isNaN(v))update(v);}}
            min={rule.minG} max={rule.maxG} step={rule.pasG}
            className="w-full text-center text-sm font-semibold py-1.5 border border-[#E8E5E1] rounded-lg
              focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9C9590] pointer-events-none">g</span>
        </div>
        <button type="button" onClick={() => update(qty + rule.pasG)} disabled={qty >= rule.maxG}
          className="w-8 h-8 rounded-lg bg-[#F5F3F0] flex items-center justify-center text-sm font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-25 transition-all active:scale-90">
          +
        </button>
      </div>

      {/* Estimation */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FEF8F0] border border-[#F5E6D0]">
        <span className="text-xs shrink-0">💡</span>
        <p className="text-[11px] text-[#B45309] leading-snug">{estText}</p>
      </div>
    </div>
  );
}
