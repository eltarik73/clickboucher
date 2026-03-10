"use client";

import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";
import { CartItemCard } from "./CartItem";

export function CartPanel() {
  const { state, updateQty, removeItem, clear, itemCount, totalCents } = useCart();
  const items = state.items;
  const total = totalCents / 100;
  const count = itemCount;

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Votre panier est vide</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b dark:border-white/10">
        <h3 className="font-semibold dark:text-white">Panier ({count})</h3>
        <button type="button" onClick={clear} className="text-sm text-red-500 hover:underline">
          Vider
        </button>
      </div>
      
      <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
        {items.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onQuantityChange={(id, qty) => updateQty(id, qty)}
            onRemove={(id) => removeItem(id)}
          />
        ))}
      </div>
      
      <div className="border-t dark:border-white/10 p-4 space-y-3">
        <div className="flex justify-between font-semibold dark:text-white">
          <span>Total</span>
          <span>{total.toFixed(2)}€</span>
        </div>
        <Link
          href="/panier"
          className="block w-full py-3 bg-primary text-white text-center font-semibold rounded-xl hover:bg-primary"
        >
          Commander
        </Link>
      </div>
    </div>
  );
}
