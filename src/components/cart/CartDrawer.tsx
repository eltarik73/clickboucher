// src/components/cart/CartDrawer.tsx
"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/hooks/useCart";
import { formatPrice } from "@/lib/estimate";
import { CartItemCard } from "./CartItem";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const { items, getTotal, getItemCount, updateQuantity, removeItem, clearCart } = useCart();
  const total = getTotal();
  const count = getItemCount();

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} />

      {/* Sheet */}
      <div className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out
        ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="w-8 h-1 rounded-full bg-[#E8E5E1]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 border-b border-[#F0EDEA]">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#1A1A1A]">Votre panier</h2>
              {count > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#7A1023] text-white text-[11px] font-bold">
                  {count}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#F5F3F0] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-5">
            {count === 0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl mb-3 opacity-30">🛒</div>
                <p className="text-[14px] font-medium text-[#6B6560]">Votre panier est vide</p>
                <p className="text-[12px] text-[#9C9590] mt-1">Ajoutez des produits depuis le catalogue</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EDEA]">
                {items.map(item => (
                  <CartItemCard key={item.productId} item={item}
                    onQuantityChange={updateQuantity} onRemove={removeItem} />
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {count > 0 && (
            <div className="border-t border-[#F0EDEA] px-5 py-4 space-y-3 pb-[env(safe-area-inset-bottom,16px)]">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6B6560]">{count} article{count > 1 ? "s" : ""}</span>
                <span className="font-semibold text-[#1A1A1A]">{formatPrice(total)}</span>
              </div>
              <button type="button"
                className="w-full py-3 rounded-xl bg-[#7A1023] text-white text-[14px] font-semibold
                  hover:bg-[#5E0C1B] active:scale-[0.98] transition-all shadow-lg shadow-[#7A1023]/20">
                Commander — {formatPrice(total)}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
