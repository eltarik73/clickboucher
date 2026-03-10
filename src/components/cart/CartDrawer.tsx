"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const { state, updateQty, removeItem, clear, itemCount, totalCents } = useCart();
  const items = state.items;
  const total = totalCents / 100;
  const count = itemCount;
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap — trap Tab key inside drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      // Focus first focusable element
      setTimeout(() => {
        const first = drawerRef.current?.querySelector<HTMLElement>(
          'button, [href], input'
        );
        first?.focus();
      }, 100);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleClear = () => {
    clear();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Panier">
      {/* Backdrop — tap to close */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white dark:bg-[#141414] shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-white/10">
          <h2 className="text-lg font-semibold dark:text-white">
            Panier ({count})
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 min-h-[44px] px-3 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                Vider
              </button>
            )}
            <button
              type="button"
              aria-label="Fermer le panier"
              onClick={onClose}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              Votre panier est vide
            </div>
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

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t dark:border-white/10 p-4 space-y-3">
            <div className="flex justify-between text-lg font-semibold dark:text-white">
              <span>Total</span>
              <span>{total.toFixed(2).replace(".", ",")}€</span>
            </div>
            <Link
              href="/panier"
              onClick={onClose}
              className="block w-full py-3 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-center font-semibold rounded-xl transition-colors"
            >
              Voir le panier
            </Link>
          </div>
        )}
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
              onClick={handleClear}
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
