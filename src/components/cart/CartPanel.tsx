// src/components/cart/CartPanel.tsx
"use client";

import { useCart } from "@/lib/hooks/useCart";
import { formatPrice } from "@/lib/estimate";
import { CartItemCard } from "./CartItem";

export function CartPanel() {
  const { items, getTotal, getItemCount, updateQuantity, removeItem, clearCart } = useCart();
  const total = getTotal();
  const count = getItemCount();

  return (
    <div className="sticky top-6 bg-white rounded-2xl border border-[#E8E5E1] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EDEA]">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛒</span>
          <h2 className="text-[14px] font-semibold text-[#1A1A1A]">Votre panier</h2>
          {count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#7A1023] text-white text-[10px] font-bold min-w-[18px] text-center">
              {count}
            </span>
          )}
        </div>
        {count > 0 && (
          <button type="button" onClick={clearCart}
            className="text-[11px] text-[#9C9590] hover:text-[#DC2626] transition-colors">
            Vider
          </button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {count === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-3xl mb-3 opacity-30">🛒</div>
            <p className="text-[13px] font-medium text-[#6B6560]">Votre panier est vide</p>
            <p className="text-[11px] text-[#9C9590] mt-1 leading-relaxed">
              Parcourez le catalogue et ajoutez<br/>vos produits favoris
            </p>
          </div>
        ) : (
          <div className="px-4 divide-y divide-[#F0EDEA]">
            {items.map(item => (
              <CartItemCard key={item.productId} item={item}
                onQuantityChange={updateQuantity} onRemove={removeItem} />
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {count > 0 && (
        <div className="border-t border-[#F0EDEA] px-4 py-3 space-y-2.5">
          <div className="flex justify-between text-[12px] text-[#6B6560]">
            <span>{count} article{count > 1 ? "s" : ""}</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button type="button"
            className="w-full py-2.5 rounded-xl bg-[#7A1023] text-white text-[13px] font-semibold
              hover:bg-[#5E0C1B] active:scale-[0.98] transition-all duration-200
              shadow-md shadow-[#7A1023]/15">
            Commander — {formatPrice(total)}
          </button>
        </div>
      )}
    </div>
  );
}
