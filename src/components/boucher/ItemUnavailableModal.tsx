// ItemUnavailableModal — Stock issue modal for kitchen mode
"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";

type Props = {
  order: KitchenOrder;
  onClose: () => void;
  onConfirm: (orderId: string, unavailableItemIds: string[]) => Promise<void>;
};

export default function ItemUnavailableModal({ order, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggle(productId: string) {
    const next = new Set(selected);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setSelected(next);
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await onConfirm(order.id, [...selected]);
      onClose();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const formatUnit = (unit: string) => (unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : "barq.");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-unavailable-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-400" aria-hidden="true" />
            <h3 id="item-unavailable-title" className="text-base font-bold text-white">
              Signaler une rupture
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 transition-colors hover:text-white"
            aria-label="Fermer la fenêtre de signalement"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Order info */}
        <div className="bg-white/5 px-5 py-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Commande </span>
          <span className="font-mono text-sm font-bold text-white">#{order.orderNumber}</span>
        </div>

        {/* Items list */}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Cochez les articles en rupture de stock :
          </p>
          {order.items.map((item) => {
            const isSelected = selected.has(item.productId);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.productId)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  isSelected
                    ? "border border-orange-500/30 bg-orange-500/15"
                    : "border border-transparent bg-white/5 hover:bg-white/10"
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    isSelected ? "border-orange-500 bg-orange-500" : "border-gray-600"
                  }`}
                >
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7L6 10L11 4"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${isSelected ? "text-orange-400 line-through" : "text-white"}`}
                  >
                    {item.product?.name || item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} {formatUnit(item.product?.unit || item.unit)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-3 font-medium text-gray-500 transition-all hover:bg-white/5 hover:text-white dark:text-gray-400"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-bold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <AlertTriangle size={16} />
                Confirmer ({selected.size})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
