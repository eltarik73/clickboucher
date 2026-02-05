// src/components/product/ProductCard.tsx
"use client";

import { useState, useCallback } from "react";
import { getConversionRule } from "@/lib/conversion-config";
import { computePrice, formatPrice, formatWeight } from "@/lib/estimate";
import { QuantitySelector } from "./QuantitySelector";
import { useCart, type CartItem } from "@/lib/hooks/useCart";

export interface Product {
  id: string;
  shopId: string;
  name: string;
  subtitle?: string;
  category: string;
  prixAuKg: number;
  imageUrl?: string;
  badges?: string[];
}

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rule = getConversionRule(product.category);
  const defaultG = rule.presetsG[1] ?? rule.presetsG[0] ?? rule.minG;
  const [qty, setQty] = useState(defaultG);
  const { addItem, hasItem } = useCart();
  const isInCart = hasItem(product.id);

  const handleAdd = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    const item: CartItem = {
      productId: product.id,
      shopId: product.shopId,
      name: product.name,
      category: product.category,
      quantiteG: qty,
      prixAuKg: product.prixAuKg,
      imageUrl: product.imageUrl,
    };
    addItem(item);
    setAnimating(true);
    setTimeout(() => { setAnimating(false); setExpanded(false); }, 400);
  }, [expanded, qty, product, addItem]);

  const prix = computePrice(qty, product.prixAuKg);

  return (
    <div className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden
      ${expanded ? "border-[#7A1023]/20 shadow-lg" : "border-[#E8E5E1] shadow-sm hover:shadow-md hover:border-[#D5D0CA]"}
      ${animating ? "scale-[0.98]" : ""}`}>

      {/* Image */}
      <div className="relative aspect-[4/3] bg-[#F5F3F0] overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-30">🥩</span>
          </div>
        )}
        {/* Badges */}
        {product.badges && product.badges.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
            {product.badges.map(b => (
              <span key={b} className="px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-medium backdrop-blur-sm">
                {b}
              </span>
            ))}
          </div>
        )}
        {isInCart && !expanded && (
          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[#16803C] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5">
        <h3 className="font-semibold text-[#1A1A1A] text-[15px] leading-tight">{product.name}</h3>
        {product.subtitle && <p className="text-[12px] text-[#9C9590] mt-0.5">{product.subtitle}</p>}
        <p className="text-[15px] font-bold text-[#7A1023] mt-1.5">
          {formatPrice(product.prixAuKg)}<span className="text-[11px] font-normal text-[#9C9590]">/kg</span>
        </p>

        {/* Quick-add expand */}
        <div className={`transition-all duration-300 ease-out overflow-hidden
          ${expanded ? "max-h-[220px] opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"}`}>
          <div className="border-t border-[#F0EDEA] pt-3">
            <QuantitySelector rule={rule} initialG={qty} onChange={setQty} compact />
          </div>
        </div>

        {/* CTA */}
        <button type="button" onClick={handleAdd}
          className={`w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${expanded
              ? "bg-[#7A1023] text-white hover:bg-[#5E0C1B] shadow-md shadow-[#7A1023]/15 active:scale-[0.97]"
              : "bg-[#F5F3F0] text-[#1A1A1A] hover:bg-[#EBE8E4] active:scale-[0.97]"
            }
            ${animating ? "bg-[#16803C] text-white" : ""}`}>
          {animating ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Ajouté
            </span>
          ) : expanded ? (
            `Confirmer — ${formatPrice(prix)}`
          ) : (
            "Ajouter"
          )}
        </button>

        {expanded && !animating && (
          <button type="button" onClick={() => setExpanded(false)}
            className="w-full mt-1.5 py-1.5 text-[12px] text-[#9C9590] hover:text-[#6B6560] transition-colors">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
