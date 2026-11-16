// src/app/(boucher)/boucher/commandes/HistoryCard.tsx — read-only compact card of a finished order
// (mobile history tab and desktop history drawer).
import type { OrderStatus } from "@prisma/client";
import { Ban, CheckCircle, Clock, Package, XCircle } from "lucide-react";
import type { KitchenHistoryOrder } from "@/hooks/use-order-polling";
import { ORDER_STATUS_LABELS } from "@/lib/design-tokens";
import { formatClientName, formatPriceCents } from "@/lib/format-kitchen";
import { storedLineUnits } from "@/lib/pricing/line";

type HistoryBadge = { color: string; icon: typeof CheckCircle };
// The history lists finished orders and those waiting for their customer, never these statuses.
const NOT_IN_HISTORY_BADGE: HistoryBadge = {
  color: "bg-gray-500/20 text-gray-500 dark:text-gray-400",
  icon: Clock,
};
const STATUS_BADGE: Record<OrderStatus, HistoryBadge> = {
  PENDING: NOT_IN_HISTORY_BADGE,
  ACCEPTED: NOT_IN_HISTORY_BADGE,
  PREPARING: NOT_IN_HISTORY_BADGE,
  READY: NOT_IN_HISTORY_BADGE,
  PICKED_UP: { color: "bg-emerald-500/20 text-emerald-400", icon: Package },
  COMPLETED: { color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  DENIED: { color: "bg-red-500/20 text-red-400", icon: XCircle },
  CANCELLED: { color: "bg-red-500/20 text-red-400", icon: Ban },
  AUTO_CANCELLED: { color: "bg-gray-500/20 text-gray-500 dark:text-gray-400", icon: Ban },
  PARTIALLY_DENIED: { color: "bg-orange-500/20 text-orange-400", icon: XCircle },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryCard({ order }: { order: KitchenHistoryOrder }) {
  const badge = STATUS_BADGE[order.status];
  const BadgeIcon = badge.icon;
  const clientName = formatClientName(order.user.firstName, order.user.lastName);
  const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
  const itemCount = order.items.reduce((sum, item) => sum + storedLineUnits(item), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a1a1a]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base font-bold text-white">{ticketNumber}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{clientName}</span>
          <span
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.color}`}
          >
            <BadgeIcon size={10} />
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        <span className="ml-2 shrink-0 text-sm font-bold text-white">
          {formatPriceCents(order.totalCents)}
        </span>
      </div>

      {/* Details row */}
      <div className="flex items-center justify-between px-4 pb-3 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            {itemCount} article{itemCount > 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-gray-600">{formatDate(order.updatedAt)}</span>
      </div>
    </div>
  );
}
