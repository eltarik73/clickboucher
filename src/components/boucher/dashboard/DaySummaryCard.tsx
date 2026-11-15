// src/components/boucher/dashboard/DaySummaryCard.tsx — the newest orders of the day summary on the
// butcher dashboard.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Serialized } from "@/lib/api/json";
import { ORDER_STATUS_LABELS } from "@/lib/design-tokens";
import type { ShopDaySummary } from "@/lib/services/orders/shop-summary";
import { timeRemaining } from "./ShopStatusBar";

/** GET /api/boucher/orders/summary, as the dashboard reads it. */
export type DaySummary = Serialized<ShopDaySummary>;

// Badge colours per status; the labels are the ones of every other screen.
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: {
    label: ORDER_STATUS_LABELS.PENDING,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  },
  ACCEPTED: {
    label: ORDER_STATUS_LABELS.ACCEPTED,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  },
  PREPARING: {
    label: ORDER_STATUS_LABELS.PREPARING,
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
  },
  READY: {
    label: ORDER_STATUS_LABELS.READY,
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  },
  PICKED_UP: {
    label: ORDER_STATUS_LABELS.PICKED_UP,
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  COMPLETED: {
    label: ORDER_STATUS_LABELS.COMPLETED,
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  },
  DENIED: {
    label: ORDER_STATUS_LABELS.DENIED,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  },
  CANCELLED: {
    label: ORDER_STATUS_LABELS.CANCELLED,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  AUTO_CANCELLED: {
    label: ORDER_STATUS_LABELS.AUTO_CANCELLED,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",
  },
  PARTIALLY_DENIED: {
    label: ORDER_STATUS_LABELS.PARTIALLY_DENIED,
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function DaySummaryCard({ orders }: { orders: DaySummary["recent"] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Dernières commandes
        </h2>
        <Link
          href="/boucher/commandes"
          className="text-xs font-medium text-[#DC2626] hover:underline"
        >
          Tout voir
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card className="border-0 bg-white shadow-sm dark:bg-[#141414]">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucune commande pour le moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const st = STATUS_MAP[order.status] || STATUS_MAP.PENDING;
            const clientName = `${order.user.firstName} ${order.user.lastName.charAt(0)}.`;

            return (
              <Link key={order.id} href="/boucher/historique">
                <Card className="cursor-pointer border-0 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-[#141414]">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0">
                          <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {clientName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {order.itemCount} article{order.itemCount > 1 ? "s" : ""} ·{" "}
                            {formatTime(order.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {(order.totalCents / 100).toFixed(2).replace(".", ",")} EUR
                        </span>
                        <Badge
                          variant="outline"
                          className={`border text-[10px] font-semibold ${st.bg} ${st.color}`}
                        >
                          {st.label}
                        </Badge>
                        {order.status === "PENDING" && order.expiresAt && (
                          <span className="font-mono text-[9px] text-red-500">
                            {timeRemaining(order.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
