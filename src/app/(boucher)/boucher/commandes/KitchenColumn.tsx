// src/app/(boucher)/boucher/commandes/KitchenColumn.tsx — one desktop column of active orders
// (Nouvelles, Prêtes) with its header count and empty state.
import type { ReactNode } from "react";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import type { BoucherAction } from "@/lib/services/orders/commands/action-schema";

const TONES = {
  amber: { icon: "text-amber-400 bg-amber-500/20", count: "bg-amber-500 text-white" },
  emerald: { icon: "text-emerald-400 bg-emerald-500/20", count: "bg-emerald-500 text-white" },
};

/** What every card of the board receives besides its order. */
export type KitchenCardProps = {
  shopName: string;
  shopPrepTime: number;
  onAction: (orderId: string, action: BoucherAction) => Promise<void>;
  onStockIssue: (order: KitchenOrder) => void;
  onView: (orderId: string) => void;
};

type Props = KitchenCardProps & {
  title: string;
  count: number;
  icon: ReactNode;
  color: keyof typeof TONES;
  orders: KitchenOrder[];
  emptyMessage: string;
  emptyIcon: ReactNode;
  extra?: ReactNode;
};

export default function KitchenColumn({
  title,
  count,
  icon,
  color,
  orders,
  emptyMessage,
  emptyIcon,
  extra,
  ...cardProps
}: Props) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Column header */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#111] px-3 py-2">
        <div className={`${TONES[color].icon} rounded-md p-1`}>{icon}</div>
        <h2 className="text-xs font-bold text-white">{title}</h2>
        {count > 0 && (
          <span
            className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${TONES[color].count}`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Column content */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {extra}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            {emptyIcon}
            <p className="text-sm text-gray-600">{emptyMessage}</p>
          </div>
        ) : (
          orders.map((order) => <KitchenOrderCard key={order.id} order={order} {...cardProps} />)
        )}
      </div>
    </div>
  );
}
