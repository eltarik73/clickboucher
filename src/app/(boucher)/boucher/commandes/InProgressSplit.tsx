// src/app/(boucher)/boucher/commandes/InProgressSplit.tsx — the « En cours » orders split into
// « À préparer maintenant » (ASAP, or pickup within the preparation window) and « Précommandes »
// (scheduled later, soonest first). Both sections stay visible, even empty. Rendered as is by the
// desktop column and the mobile tab, each inside its own scrolling container.
import { CalendarClock } from "lucide-react";
import KitchenOrderCard from "@/components/boucher/KitchenOrderCard";
import { PREPARATION_WINDOW_MS } from "@/hooks/kitchen-board-diff";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import type { KitchenCardProps } from "./KitchenColumn";

type Props = KitchenCardProps & {
  orders: KitchenOrder[];
  onAdjustPrice: (order: KitchenOrder) => void;
};

export default function InProgressSplit({ orders, onAdjustPrice, ...cardProps }: Props) {
  const prepareNowOrders = orders.filter((o) => {
    if (!o.pickupSlotStart) return true; // ASAP
    return new Date(o.pickupSlotStart).getTime() <= Date.now() + PREPARATION_WINDOW_MS;
  });
  const scheduledWaitingOrders = orders
    .filter((o) => {
      if (!o.pickupSlotStart) return false;
      return new Date(o.pickupSlotStart).getTime() > Date.now() + PREPARATION_WINDOW_MS;
    })
    .sort(
      (a, b) => new Date(a.pickupSlotStart!).getTime() - new Date(b.pickupSlotStart!).getTime()
    );

  return (
    <>
      {/* Section 1: À préparer maintenant */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <div
          className={`h-2 w-2 rounded-full ${prepareNowOrders.length > 0 ? "animate-pulse bg-emerald-400" : "bg-gray-700"}`}
        />
        <span
          className={`text-xs font-bold uppercase tracking-wider ${prepareNowOrders.length > 0 ? "text-emerald-400" : "text-gray-600"}`}
        >
          À PRÉPARER MAINTENANT
        </span>
        {prepareNowOrders.length > 0 && (
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
            {prepareNowOrders.length}
          </span>
        )}
      </div>
      {prepareNowOrders.length > 0 ? (
        prepareNowOrders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            {...cardProps}
            onAdjustPrice={onAdjustPrice}
          />
        ))
      ) : (
        <p className="py-3 text-center text-xs text-gray-700">Aucune commande à préparer</p>
      )}

      {/* Separator */}
      <div className="flex items-center gap-3 py-1.5">
        <div className="h-px flex-1 bg-[#1A1A1A]" />
        <CalendarClock size={13} className="text-[#F59E0B]/50" />
        <div className="h-px flex-1 bg-[#1A1A1A]" />
      </div>

      {/* Section 2: Précommandes */}
      <div className="flex items-center gap-2 px-1">
        <CalendarClock
          size={14}
          className={scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-700"}
        />
        <span
          className={`text-xs font-bold uppercase tracking-wider ${scheduledWaitingOrders.length > 0 ? "text-[#FBBF24]" : "text-gray-600"}`}
        >
          PRÉCOMMANDES
        </span>
        {scheduledWaitingOrders.length > 0 && (
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-[#FBBF24]">
            {scheduledWaitingOrders.length}
          </span>
        )}
      </div>
      {scheduledWaitingOrders.length > 0 ? (
        scheduledWaitingOrders.map((order) => (
          <KitchenOrderCard key={order.id} order={order} {...cardProps} />
        ))
      ) : (
        <p className="py-3 text-center text-xs text-gray-700">Aucune commande programmée</p>
      )}
    </>
  );
}
