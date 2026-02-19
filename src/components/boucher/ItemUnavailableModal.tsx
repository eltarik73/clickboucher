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

  const formatUnit = (unit: string) =>
    unit === "KG" ? "kg" : unit === "PIECE" ? "pc" : "barq.";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] rounded-2xl max-w-md w-full shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-400" />
            <h3 className="font-bold text-white text-base">
              Signaler une rupture
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Order info */}
        <div className="px-5 py-3 bg-white/5">
          <span className="text-xs text-gray-400">Commande </span>
          <span className="text-sm font-mono font-bold text-white">
            #{order.orderNumber}
          </span>
        </div>

        {/* Items list */}
        <div className="px-5 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
          <p className="text-sm text-gray-400 mb-2">
            Cochez les articles en rupture de stock :
          </p>
          {order.items.map((item) => {
            const isSelected = selected.has(item.productId);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.productId)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  isSelected
                    ? "bg-orange-500/15 border border-orange-500/30"
                    : "bg-white/5 border border-transparent hover:bg-white/10"
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-orange-500 border-orange-500"
                      : "border-gray-600"
                  }`}
                >
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isSelected ? "text-orange-400 line-through" : "text-white"}`}>
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
        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-medium transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || loading}
            className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
