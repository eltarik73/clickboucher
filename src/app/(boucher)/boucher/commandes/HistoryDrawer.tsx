// src/app/(boucher)/boucher/commandes/HistoryDrawer.tsx — the desktop history, a slide-up drawer
// over the board listing the finished orders of the last 7 days.
import { ScrollText } from "lucide-react";
import type { KitchenHistoryOrder } from "@/hooks/use-order-polling";
import HistoryCard from "./HistoryCard";

type Props = {
  orders: KitchenHistoryOrder[];
  onClose: () => void;
};

export default function HistoryDrawer({ orders, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70]" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="absolute inset-x-0 bottom-0 flex h-[70vh] animate-slide-up flex-col rounded-t-2xl border-t border-white/10 bg-[#111]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + Header */}
        <div className="shrink-0 px-5 pb-2 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={16} className="text-gray-500 dark:text-gray-400" />
              <h3 className="text-base font-bold text-white">Historique</h3>
              <span className="text-xs text-gray-500">7 derniers jours</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              Fermer
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <ScrollText size={32} className="text-gray-700" />
              <p className="text-sm text-gray-600">Aucune commande récente</p>
            </div>
          ) : (
            orders.map((order) => <HistoryCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );
}
