// OrderAlertOverlay — Green pulsing overlay when new order arrives (Uber Eats style)
"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { KitchenOrder } from "@/hooks/use-order-polling";

type Props = {
  order: KitchenOrder | null;
  onDismiss: () => void;
};

export default function OrderAlertOverlay({ order, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (order) {
      setVisible(true);
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [order, onDismiss]);

  if (!visible || !order) return null;

  const formatPrice = (cents: number) =>
    (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center cursor-pointer animate-pulse-slow"
      style={{
        background: "radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.08) 70%, transparent 100%)",
        backdropFilter: "blur(2px)",
      }}
      onClick={() => {
        setVisible(false);
        onDismiss();
      }}
    >
      {/* Alert card */}
      <div
        className="bg-[#141414] border-2 border-emerald-500/50 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-emerald-500/20 animate-bounce-gentle"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Bell size={32} className="text-emerald-400 animate-ring" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-1">
          Nouvelle commande !
        </h2>

        <p className="text-emerald-400 text-center text-lg font-mono font-bold mb-4">
          #{order.orderNumber}
        </p>

        <div className="bg-white/5 rounded-xl p-4 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Client</span>
            <span className="text-white font-medium">
              {order.user
                ? `${order.user.firstName} ${order.user.lastName}`
                : "Client"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Articles</span>
            <span className="text-white font-medium">
              {order.items.length} article{order.items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total</span>
            <span className="text-emerald-400 font-bold text-base">
              {formatPrice(order.totalCents)}
            </span>
          </div>
          {order.isPro && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Type</span>
              <span className="text-amber-400 font-bold">PRO</span>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-base"
        >
          Voir la commande
        </button>
      </div>
    </div>
  );
}
