// src/app/(boucher)/boucher/commandes/KitchenMobileBoard.tsx — the phone and tablet layout (below
// lg): the single column of the tab chosen in KitchenTabs.
import { Bell, CheckCircle, ScanLine, ScrollText } from "lucide-react";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";
import type { KitchenHistoryOrder, KitchenOrder } from "@/hooks/use-order-polling";
import HistoryCard from "./HistoryCard";
import InProgressSplit from "./InProgressSplit";
import type { KitchenCardProps } from "./KitchenColumn";
import type { KitchenTab } from "./KitchenTabs";

type Props = KitchenCardProps & {
  activeTab: KitchenTab;
  pendingOrders: KitchenOrder[];
  inProgressOrders: KitchenOrder[];
  readyOrders: KitchenOrder[];
  historyOrders: KitchenHistoryOrder[];
  onAdjustPrice: (order: KitchenOrder) => void;
  onOpenScanner: () => void;
};

export default function KitchenMobileBoard({
  activeTab,
  pendingOrders,
  inProgressOrders,
  readyOrders,
  historyOrders,
  onAdjustPrice,
  onOpenScanner,
  ...cardProps
}: Props) {
  // Orders of the Nouvelles or Prêtes tab; the other two tabs render their own lists
  const activeOrders = activeTab === "nouvelles" ? pendingOrders : readyOrders;

  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto p-3 pb-4 lg:hidden">
      {/* Scanner button for ready tab */}
      {activeTab === "pretes" && readyOrders.length > 0 && (
        <button
          onClick={onOpenScanner}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626] py-3 font-bold text-white transition-all hover:bg-[#b91c1c]"
        >
          <ScanLine size={16} /> Scanner QR
        </button>
      )}

      {activeTab === "historique" ? (
        /* History tab — read-only compact cards */
        historyOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <ScrollText size={40} className="text-gray-700" />
            <p className="text-sm text-gray-600">Aucune commande récente</p>
          </div>
        ) : (
          historyOrders.map((order) => <HistoryCard key={order.id} order={order} />)
        )
      ) : activeTab === "en-cours" ? (
        /* En cours tab — always split: À préparer + Précommandes */
        <InProgressSplit orders={inProgressOrders} {...cardProps} onAdjustPrice={onAdjustPrice} />
      ) : activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          {activeTab === "nouvelles" && <Bell size={40} className="text-gray-700" />}
          {activeTab === "pretes" && <CheckCircle size={40} className="text-gray-700" />}
          <p className="text-sm text-gray-600">
            {activeTab === "nouvelles" && "Aucune nouvelle commande"}
            {activeTab === "pretes" && "Aucune commande prête"}
          </p>
        </div>
      ) : (
        activeOrders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            {...cardProps}
            onAdjustPrice={onAdjustPrice}
          />
        ))
      )}
    </div>
  );
}
