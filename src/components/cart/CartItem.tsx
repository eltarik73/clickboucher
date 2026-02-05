// src/components/cart/CartItem.tsx
"use client";

import { getConversionRule } from "@/lib/conversion-config";
import { computePrice, formatPrice, formatWeight, computeEstimation, formatEstimationShort } from "@/lib/estimate";
import type { CartItem as CartItemType } from "@/lib/hooks/useCart";

interface Props {
  item: CartItemType;
  onQuantityChange: (id: string, g: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemCard({ item, onQuantityChange, onRemove }: Props) {
  const rule = getConversionRule(item.category);
  const prix = computePrice(item.quantiteG, item.prixAuKg);
  const est = computeEstimation(item.quantiteG, item.category);
  const estShort = formatEstimationShort(est);

  return (
    <div className="flex gap-2.5 py-3 group">
      {/* Mini image */}
      <div className="w-11 h-11 rounded-lg bg-[#F5F3F0] overflow-hidden shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg opacity-30">🥩</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Row 1: name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{item.name}</p>
            <p className="text-[11px] text-[#9C9590]">{formatWeight(item.quantiteG)} · {estShort}</p>
          </div>
          <p className="text-[13px] font-semibold text-[#1A1A1A] shrink-0">{formatPrice(prix)}</p>
        </div>

        {/* Row 2: stepper + delete */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onQuantityChange(item.productId, item.quantiteG - rule.pasG)}
              disabled={item.quantiteG <= rule.minG}
              className="w-6 h-6 rounded-md bg-[#F5F3F0] flex items-center justify-center text-[11px] font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-25 transition-all">
              −
            </button>
            <span className="text-[12px] font-medium text-[#1A1A1A] min-w-[36px] text-center">{formatWeight(item.quantiteG)}</span>
            <button type="button" onClick={() => onQuantityChange(item.productId, item.quantiteG + rule.pasG)}
              disabled={item.quantiteG >= rule.maxG}
              className="w-6 h-6 rounded-md bg-[#F5F3F0] flex items-center justify-center text-[11px] font-bold text-[#6B6560] hover:bg-[#EBE8E4] disabled:opacity-25 transition-all">
              +
            </button>
          </div>
          <button type="button" onClick={() => onRemove(item.productId)}
            className="p-1 rounded-md text-[#9C9590] hover:text-[#DC2626] hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
