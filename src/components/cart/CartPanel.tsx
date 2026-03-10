"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { CartItemCard } from "./CartItem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function CartPanel() {
  const { state, updateQty, removeItem, clear, itemCount, totalCents } = useCart();
  const items = state.items;
  const total = totalCents / 100;
  const count = itemCount;
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 min-h-[44px] px-3 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
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
          <span>{total.toFixed(2).replace(".", ",")}€</span>
        </div>
        <Link
          href="/panier"
          className="block w-full py-3 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-center font-semibold rounded-xl transition-colors"
        >
          Commander
        </Link>
      </div>

      {/* Clear confirmation dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Vider le panier ?</DialogTitle>
            <DialogDescription>
              Tous les articles seront supprimes. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 px-5 pb-5 pt-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => { clear(); setShowClearConfirm(false); }}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              Oui, vider
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
