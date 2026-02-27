// /boucher/historique — Historique des commandes (7 derniers jours)
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardList,
  Search,
  Package,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  RefreshCw,
} from "lucide-react";

type HistoryFilter = "all" | "completed" | "cancelled" | "expired";

type Order = {
  id: string;
  orderNumber: number;
  displayNumber?: string;
  status: string;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  pickupTime?: string;
  user: { firstName: string; lastName: string } | null;
  items: { quantity: number }[];
};

const HISTORY_STATUSES = [
  "PICKED_UP",
  "COMPLETED",
  "DENIED",
  "CANCELLED",
  "AUTO_CANCELLED",
  "PARTIALLY_DENIED",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  PICKED_UP: {
    label: "Récupérée",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    icon: Package,
  },
  COMPLETED: {
    label: "Terminée",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    icon: CheckCircle,
  },
  DENIED: {
    label: "Refusée",
    color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Annulée",
    color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    icon: Ban,
  },
  AUTO_CANCELLED: {
    label: "Expirée",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
    icon: Ban,
  },
  PARTIALLY_DENIED: {
    label: "Partielle",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
    icon: XCircle,
  },
};

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "completed", label: "Terminées" },
  { key: "cancelled", label: "Annulées" },
  { key: "expired", label: "Expirées" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function anonymizeName(user: { firstName: string; lastName: string } | null) {
  if (!user) return "Client";
  return `${user.firstName} ${user.lastName.charAt(0)}.`;
}

export default function HistoriquePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const json = await res.json();
        const allOrders: Order[] = json.data || [];

        // Filter to history statuses + last 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const history = allOrders
          .filter(
            (o) =>
              HISTORY_STATUSES.includes(o.status) &&
              new Date(o.createdAt).getTime() > sevenDaysAgo
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        setOrders(history);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Apply filters
  const filtered = orders.filter((o) => {
    if (filter === "completed" && !["PICKED_UP", "COMPLETED"].includes(o.status))
      return false;
    if (
      filter === "cancelled" &&
      !["CANCELLED", "DENIED", "PARTIALLY_DENIED"].includes(o.status)
    )
      return false;
    if (filter === "expired" && o.status !== "AUTO_CANCELLED") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = anonymizeName(o.user).toLowerCase();
      const num = (o.displayNumber || `#${o.orderNumber}`).toLowerCase();
      if (!name.includes(q) && !num.includes(q)) return false;
    }

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList size={22} />
            Commandes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Historique des 7 derniers jours
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchOrders();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="N° commande, client..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ClipboardList size={40} className="text-gray-300 dark:text-gray-700" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Aucune commande trouvée
          </p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="hidden md:block bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    N°
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Retrait
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filtered.map((order) => {
                  const badge = STATUS_CONFIG[order.status] || {
                    label: order.status,
                    color:
                      "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
                    icon: Clock,
                  };
                  const BadgeIcon = badge.icon;
                  const ticket =
                    order.displayNumber || `#${order.orderNumber}`;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {ticket}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {anonymizeName(order.user)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(order.createdAt)}{" "}
                        {formatTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {formatPrice(order.totalCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${badge.color}`}
                        >
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {order.pickupTime
                          ? formatTime(order.pickupTime)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((order) => {
              const badge = STATUS_CONFIG[order.status] || {
                label: order.status,
                color:
                  "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
                icon: Clock,
              };
              const BadgeIcon = badge.icon;
              const ticket =
                order.displayNumber || `#${order.orderNumber}`;
              const itemCount = order.items.reduce(
                (s, i) => s + i.quantity,
                0
              );

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {ticket}
                      </span>
                      <span className="text-sm text-gray-400">
                        {anonymizeName(order.user)}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.color}`}
                    >
                      <BadgeIcon size={10} />
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {itemCount} article{itemCount > 1 ? "s" : ""} ·{" "}
                      {formatDate(order.createdAt)}{" "}
                      {formatTime(order.createdAt)}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                      {formatPrice(order.totalCents)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} commande{filtered.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
