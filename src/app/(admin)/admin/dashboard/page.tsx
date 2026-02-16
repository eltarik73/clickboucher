"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Package,
  Store,
  Users,
  Clock,
  ShoppingBag,
  AlertTriangle,
  Briefcase,
  TrendingUp,
  Star,
} from "lucide-react";
import Link from "next/link";

type Stats = {
  totalRevenue: number;
  revenueThisMonth: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  activeShops: number;
  totalUsers: number;
  totalProducts: number;
  pendingProRequests: number;
  avgRating: number;
  topShops: {
    id: string;
    name: string;
    rating: number;
    orderCount: number;
    revenue: number;
  }[];
  alerts: {
    staleOrders: {
      id: string;
      orderNumber: string;
      shopName: string;
      minutesAgo: number;
    }[];
    pausedShops: { id: string; name: string }[];
    pendingProRequests: number;
  };
};

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error("Erreur chargement");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-32">
        <p className="text-red-500 font-medium">{error || "Erreur inconnue"}</p>
      </div>
    );
  }

  const kpis = [
    {
      label: "Revenus total",
      value: fmt(stats.totalRevenue) + " \u20ac",
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Revenus ce mois",
      value: fmt(stats.revenueThisMonth) + " \u20ac",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Commandes aujourd\u2019hui",
      value: stats.todayOrders.toString(),
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      label: "Boucheries actives",
      value: stats.activeShops.toString(),
      icon: Store,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-500/10",
    },
    {
      label: "Utilisateurs",
      value: stats.totalUsers.toString(),
      icon: Users,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-500/10",
    },
    {
      label: "Commandes en attente",
      value: stats.pendingOrders.toString(),
      icon: Clock,
      color:
        stats.pendingOrders > 0
          ? "text-red-600 dark:text-red-400"
          : "text-gray-600 dark:text-gray-400",
      bg:
        stats.pendingOrders > 0
          ? "bg-red-50 dark:bg-red-500/10"
          : "bg-gray-50 dark:bg-[white/10]",
    },
    {
      label: "Produits en catalogue",
      value: stats.totalProducts.toString(),
      icon: ShoppingBag,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Demandes Pro",
      value: stats.pendingProRequests.toString(),
      icon: Briefcase,
      color:
        stats.pendingProRequests > 0
          ? "text-orange-600 dark:text-orange-400"
          : "text-gray-600 dark:text-gray-400",
      bg:
        stats.pendingProRequests > 0
          ? "bg-orange-50 dark:bg-orange-500/10"
          : "bg-gray-50 dark:bg-[white/10]",
    },
  ];

  const hasAlerts =
    stats.alerts.staleOrders.length > 0 ||
    stats.alerts.pausedShops.length > 0 ||
    stats.alerts.pendingProRequests > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Administration Klik&amp;Go
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 capitalize">
          {today}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] p-4 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={18} className={kpi.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3] tracking-tight">
                {kpi.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {kpi.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Top 5 Shops */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[white/10]">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
              Top 5 Boucheries
            </h2>
          </div>
          {stats.topShops.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Aucune commande finalis\u00e9e pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium">Boucherie</th>
                    <th className="px-5 py-3 font-medium text-right">Commandes</th>
                    <th className="px-5 py-3 font-medium text-right">Revenus</th>
                    <th className="px-5 py-3 font-medium text-right">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[white/10]">
                  {stats.topShops.map((shop, i) => (
                    <tr key={shop.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[white/10] text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-[#f8f6f3]">
                            {shop.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                        {shop.orderCount}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                        {fmt(shop.revenue)} \u20ac
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Star size={12} fill="currentColor" />
                          {shop.rating.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[white/10]">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3] flex items-center gap-2">
              <AlertTriangle
                size={16}
                className={
                  hasAlerts
                    ? "text-orange-500"
                    : "text-gray-400 dark:text-gray-500"
                }
              />
              Alertes
              {hasAlerts && (
                <span className="ml-auto text-xs font-normal text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full">
                  Action requise
                </span>
              )}
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {!hasAlerts && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                Aucune alerte pour le moment.
              </p>
            )}

            {/* Stale orders */}
            {stats.alerts.staleOrders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                  Commandes en attente &gt; 30 min
                </h3>
                <div className="space-y-2">
                  {stats.alerts.staleOrders.map((o) => (
                    <Link
                      key={o.id}
                      href="/admin/orders"
                      className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                          #{o.orderNumber}
                        </span>
                        <span className="text-xs text-red-500 dark:text-red-400 ml-2">
                          {o.shopName}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                        {o.minutesAgo} min
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Paused shops */}
            {stats.alerts.pausedShops.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                  Boucheries en pause
                </h3>
                <div className="space-y-2">
                  {stats.alerts.pausedShops.map((s) => (
                    <Link
                      key={s.id}
                      href="/admin/shops"
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors"
                    >
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {s.name}
                      </span>
                      <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                        En pause
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pending pro requests */}
            {stats.alerts.pendingProRequests > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">
                  Demandes Pro en attente
                </h3>
                <Link
                  href="/admin/users"
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/15 transition-colors"
                >
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {stats.alerts.pendingProRequests} demande
                    {stats.alerts.pendingProRequests > 1 ? "s" : ""} en attente
                  </span>
                  <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">
                    Voir &rarr;
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats footer */}
      <div className="flex items-center justify-between bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-[white/10] shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Total commandes :</span>
          <span className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
            {stats.totalOrders}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Note moyenne :</span>
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            <Star size={14} fill="currentColor" />
            {stats.avgRating.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
