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
  shopName?: string;
  shopSlug?: string;
  name: string;
  subtitle?: string;
  category: string;
  prixAuKg: number;
  imageUrl?: string;
  badges?: string[];
}

interface Props {
  product: Product;
  shop?: { id: string; name: string; slug: string };
}

export function ProductCard({ product, shop }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rule = getConversionRule(product.category);
  const defaultG = rule.presetsG[1] ?? rule.presetsG[0] ?? rule.minG;
  const [qty, setQty] = useState(defaultG);
  const { addItem, state } = useCart();

  const isInCart = state.items.some(item => item.productId === product.id);

  const handleAdd = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      return;
    }

    const shopInfo = shop || {
      id: product.shopId,
      name: product.shopName || "Boutique",
      slug: product.shopSlug || product.shopId
    };

    const item: CartItem = {
      id: `${shopInfo.id}-${product.id}`,
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl || "",
      unit: "KG",
      priceCents: Math.round(product.prixAuKg * 100),
      quantity: 1,
      weightGrams: qty,
      category: product.category,
      quantiteG: qty,
      prixAuKg: product.prixAuKg,
    };

    addItem(item, shopInfo);
    setAnimating(true);
    setTimeout(() => { setAnimating(false); setExpanded(false); }, 400);
  }, [expanded, qty, product, shop, addItem]);

  const prix = computePrice(qty, product.prixAuKg);
  const prixFormate = product.prixAuKg.toFixed(2).replace(".", ",") + " \u20AC";

  return (
    <div className={`group relative flex gap-2.5 bg-[#141414] border border-[#1e1e1e] rounded-2xl p-2 cursor-pointer
      transition-all duration-250 overflow-hidden
      hover:border-[#333] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(220,38,38,0.06)]
      active:scale-[0.97] ${animating ? "scale-[0.97]" : ""}`}>

      {/* Subtle red gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(220,38,38,0.03)] to-transparent pointer-events-none" />

      {/* Image 68px */}
      <div className="w-[68px] h-[68px] rounded-xl overflow-hidden border border-[#222] shrink-0">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-2xl opacity-30">🥩</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center relative z-[1]">
        <span className="text-[8px] font-bold text-[#dc2626] uppercase tracking-wider mb-0.5">
          {product.category}
        </span>
        <h3 style={{ fontFamily: "'Playfair Display', serif" }}
          className="text-[13.5px] font-bold text-[#eee] leading-tight truncate">
          {product.name}
        </h3>
        {product.subtitle && (
          <p className="text-[10.5px] text-[#444] mt-0.5 truncate">{product.subtitle}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-extrabold text-white">{prixFormate}</span>
          <span className="text-[10px] text-[#555] font-semibold">/kg</span>
        </div>
      </div>

      {/* Badges */}
      {product.badges && product.badges.length > 0 && (
        <div className="absolute top-0 left-0 bg-[#dc2626] text-white text-[7px] font-extrabold px-2 py-0.5 rounded-[16px_0_8px_0] tracking-wide z-10">
          {product.badges[0]}
        </div>
      )}

      {/* In-cart indicator */}
      {isInCart && !expanded && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#16803C] flex items-center justify-center z-10">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* + Button */}
      {!expanded && (
        <button onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          className="absolute right-2 bottom-2 w-[30px] h-[30px] rounded-[10px] bg-[#1a1a1a] border border-[#2a2a2a]
            flex items-center justify-center transition-all z-10
            group-hover:bg-[#dc2626] group-hover:border-[#dc2626]">
          <svg className="w-[14px] h-[14px] stroke-[#555] stroke-[2.5] fill-none group-hover:stroke-white" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Weight selector expansion */}
      {expanded && (
        <div className="absolute inset-0 bg-[#141414] z-20 p-3 flex flex-col rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <h4 style={{ fontFamily: "'Playfair Display', serif" }}
              className="text-sm font-bold text-[#eee]">{product.name}</h4>
            <button onClick={() => setExpanded(false)} className="text-xs text-[#555] hover:text-[#888]">✕</button>
          </div>
          <div className="flex-1">
            <QuantitySelector rule={rule} initialG={qty} onChange={setQty} compact />
          </div>
          <button type="button" onClick={handleAdd}
            className={`mt-2 w-full py-2 rounded-xl text-sm font-semibold transition-all
              ${animating ? "bg-[#16803C] text-white" : "bg-[#dc2626] text-white hover:bg-[#b91c1c]"}`}>
            {animating ? "Ajouté ✓" : `Confirmer — ${formatPrice(prix)}`}
          </button>
        </div>
      )}
    </div>
  );
}
