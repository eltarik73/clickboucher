"use client";

import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";
import { CartItemCard } from "./CartItem";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const { state, updateQty, removeItem, clear, itemCount, totalCents } = useCart();
  const items = state.items;
  const total = totalCents / 100;
  const count = itemCount;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Panier ({count})</h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button type="button" onClick={clear} className="text-sm text-red-500 hover:underline">
                Vider
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Votre panier est vide</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onQuantityChange={(id, qty) => updateQty(id, qty)}
                  onRemove={(id) => removeItem(id)}
                />
              ))}
            </div>
          )}
        </div>
        
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{total.toFixed(2)}€</span>
            </div>
            <Link
              href="/panier"
              onClick={onClose}
              className="block w-full py-3 bg-[#DC2626] text-white text-center font-semibold rounded-xl hover:bg-[#DC2626]"
            >
              Voir le panier
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
