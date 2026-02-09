// src/components/product/ProductCard.tsx
"use client";

import { useState, useCallback } from "react";
import { getConversionRule } from "@/lib/conversion-config";
import { getProductImage } from "@/lib/product-images";
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
      imageUrl: product.imageUrl || getProductImage(product.category),
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
    <div className={`group relative flex gap-3 bg-white border border-[#ece8e3] rounded-[18px] p-2.5 cursor-pointer
      transition-all duration-250 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.03)]
      hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#ddd5cc]
      active:scale-[0.97] ${animating ? "scale-[0.97]" : ""}`}>

      {/* Image 68px */}
      <div className="shrink-0">
        <img
          src={product.imageUrl || getProductImage(product.category)}
          alt={product.name}
          width={68}
          height={68}
          className="rounded-xl object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center relative z-[1]">
        <span className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wider mb-0.5">
          {product.category}
        </span>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif" }}
          className="text-[15px] font-bold text-[#2a2018] leading-tight truncate">
          {product.name}
        </h3>
        {product.subtitle && (
          <p className="text-[10.5px] text-[#7a7068] mt-0.5 truncate">{product.subtitle}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-extrabold text-[#2a2018]">{prixFormate}</span>
          <span className="text-[10px] text-[#767676] font-semibold">/kg</span>
        </div>
      </div>

      {/* Badge POPULAIRE */}
      {product.badges && product.badges.length > 0 && (
        <div className="absolute -top-px -left-px bg-[#DC2626] text-white text-[7.5px] font-extrabold px-2.5 py-[3px] rounded-[18px_0_10px_0] tracking-wide z-10">
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
        <button
          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          className="absolute right-2 bottom-2 w-7 h-7 rounded-lg bg-[#f5f0eb] border border-[#e8e3dc] flex items-center justify-center text-[#999] hover:bg-[#DC2626] hover:border-[#DC2626] hover:text-white transition-colors z-10"
        >
          <svg className="w-3.5 h-3.5 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Weight selector expansion */}
      {expanded && (
        <div className="absolute inset-0 bg-white z-20 p-3 flex flex-col rounded-[18px]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <h4 style={{ fontFamily: "'Cormorant Garamond', serif" }}
              className="text-sm font-bold text-[#2a2018]">{product.name}</h4>
            <button onClick={() => setExpanded(false)} className="text-xs text-[#7a7068] hover:text-[#DC2626]">✕</button>
          </div>
          <div className="flex-1">
            <QuantitySelector rule={rule} initialG={qty} onChange={setQty} compact />
          </div>
          <button type="button" onClick={handleAdd}
            className={`mt-2 w-full py-2 rounded-xl text-sm font-semibold transition-all
              ${animating ? "bg-[#16803C] text-white" : "bg-[#DC2626] text-white hover:bg-[#6e1d00]"}`}>
            {animating ? "Ajouté \u2713" : `Confirmer \u2014 ${formatPrice(prix)}`}
          </button>
        </div>
      )}
    </div>
  );
}
