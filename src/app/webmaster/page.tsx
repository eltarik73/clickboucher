"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  ShoppingCart,
  Store,
  Users,
  Coins,
  AlertTriangle,
  Clock,
  PauseCircle,
  ArrowRight,
  Trophy,
} from "lucide-react";

// ── Types ──

type AdminStats = {
  totalRevenue: number;
  revenueThisMonth: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  activeShops: number;
  totalShops: number;
  totalUsers: number;
  totalProducts: number;
  pendingProRequests: number;
  avgRating: number;
  totalCommissionCents: number;
  shopsByPlan: Record<string, number>;
  ordersLast7Days: { date: string; orders: number; revenue: number }[];
  topShops: { id: string; name: string; rating: number; orderCount: number; revenue: number }[];
  alerts: {
    staleOrders: { id: string; orderNumber: string; shopName: string; minutesAgo: number }[];
    pausedShops: { id: string; name: string }[];
    pendingProRequests: number;
  };
};

// ── Helpers ──

function centsToEuro(c: number) {
  return (c / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function shortEuro(c: number) {
  if (c >= 100_000_00) return (c / 100_00).toFixed(0) + "k\u20AC";
  return centsToEuro(c);
}

// ── Component ──

export default function WebmasterDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setStats(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-center text-gray-400 py-12">
        Impossible de charger les statistiques
      </p>
    );
  }

  const weekData = stats.ordersLast7Days || [];
  const maxOrders = Math.max(...weekData.map((d) => d.orders), 1);
  const totalWeek = weekData.reduce((s, d) => s + d.orders, 0);
  const weekRevenue = weekData.reduce((s, d) => s + d.revenue, 0);
  const avgOrder = stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0;
  const hasAlerts = stats.alerts.staleOrders.length > 0 || stats.alerts.pausedShops.length > 0 || stats.alerts.pendingProRequests > 0;

  const KPI_CARDS = [
    {
      label: "CA total",
      value: shortEuro(stats.totalRevenue),
      sub: `Ce mois: ${shortEuro(stats.revenueThisMonth)}`,
      icon: TrendingUp,
      color: "text-[#DC2626]",
      bg: "bg-[#DC2626]/10",
    },
    {
      label: "Commandes",
      value: String(stats.totalOrders),
      sub: `Aujourd'hui: ${stats.todayOrders} | En attente: ${stats.pendingOrders}`,
      icon: ShoppingCart,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Boutiques",
      value: `${stats.activeShops}/${stats.totalShops}`,
      sub: `Actives / Total | ${stats.totalProducts} produits`,
      icon: Store,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Clients",
      value: String(stats.totalUsers),
      sub: `Note moy: ${stats.avgRating.toFixed(1)}/5`,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Commission",
      value: shortEuro(stats.totalCommissionCents),
      sub: "Total perçues",
      icon: Coins,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Panier moyen",
      value: centsToEuro(avgOrder),
      sub: `Sem: ${totalWeek} cmd | ${shortEuro(weekRevenue)}`,
      icon: ShoppingCart,
      color: "text-gray-900 dark:text-white",
      bg: "bg-gray-500/10",
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Vue d&apos;ensemble de la plateforme Klik&amp;Go
        </p>
      </div>

      {/* Alerts banner */}
      {hasAlerts && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Alertes</span>
          </div>
          <div className="space-y-1.5">
            {stats.alerts.staleOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300/80">
                <Clock size={12} />
                <span>
                  <strong>{o.orderNumber}</strong> en attente depuis {o.minutesAgo} min ({o.shopName})
                </span>
              </div>
            ))}
            {stats.alerts.pausedShops.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300/80">
                <PauseCircle size={12} />
                <span><strong>{s.name}</strong> est en pause</span>
              </div>
            ))}
            {stats.alerts.pendingProRequests > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300/80">
                <Users size={12} />
                <span><strong>{stats.alerts.pendingProRequests}</strong> demande(s) PRO en attente</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {KPI_CARDS.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <Icon size={16} className={kpi.color} />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {kpi.label}
                </span>
              </div>
              <p className={`text-xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly orders bar chart */}
        {weekData.length > 0 && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
            <h3 className="font-display text-sm font-bold text-gray-900 dark:text-white mb-4">
              Commandes (7 jours)
            </h3>
            <div className="flex items-end gap-2 h-[130px]">
              {weekData.map((d, i) => {
                const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" });
                const isMax = d.orders === maxOrders && d.orders > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      {d.orders}
                    </span>
                    <div
                      className={`w-full rounded-t-lg animate-fade-up ${
                        isMax ? "bg-[#DC2626]" : "bg-gray-200 dark:bg-white/10"
                      }`}
                      style={{
                        height: `${Math.max((d.orders / maxOrders) * 100, 4)}px`,
                        animationDelay: `${i * 70}ms`,
                      }}
                    />
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 capitalize">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Plans distribution */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
          <h3 className="font-display text-sm font-bold text-gray-900 dark:text-white mb-4">
            Boutiques par plan
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.shopsByPlan).map(([plan, count]) => {
              const total = stats.totalShops || 1;
              const pct = Math.round((count / total) * 100);
              const colors: Record<string, string> = {
                STARTER: "bg-gray-400",
                PRO: "bg-blue-500",
                PREMIUM: "bg-[#DC2626]",
              };
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{plan}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors[plan] || "bg-gray-400"} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {stats.totalShops > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
              {stats.totalShops} boutique{stats.totalShops > 1 ? "s" : ""} au total
            </p>
          )}
        </div>
      </div>

      {/* Top shops + Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 5 shops */}
        {stats.topShops.length > 0 && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-amber-500" />
              <h3 className="font-display text-sm font-bold text-gray-900 dark:text-white">
                Top boutiques
              </h3>
            </div>
            <div className="space-y-2.5">
              {stats.topShops.map((shop, i) => (
                <div key={shop.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : i === 1 ? "bg-gray-300/30 text-gray-500 dark:text-gray-400"
                    : i === 2 ? "bg-orange-300/20 text-orange-600 dark:text-orange-400"
                    : "bg-gray-100 dark:bg-white/5 text-gray-400"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{shop.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {shop.orderCount} cmd &middot; {centsToEuro(shop.revenue)} &middot; {shop.rating.toFixed(1)}&#9733;
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-5">
          <h3 className="font-display text-sm font-bold text-gray-900 dark:text-white mb-4">
            Actions rapides
          </h3>
          <div className="space-y-2">
            {[
              { label: "Gerer les boutiques", href: "/webmaster/boutiques", count: stats.totalShops },
              { label: "Voir les commandes", href: "/webmaster/commandes", count: stats.pendingOrders > 0 ? `${stats.pendingOrders} en attente` : null },
              { label: "Demandes PRO", href: "/webmaster/demandes", count: stats.pendingProRequests > 0 ? `${stats.pendingProRequests} en attente` : null },
              { label: "Feature Flags", href: "/webmaster/flags", count: null },
              { label: "Audit Log", href: "/webmaster/audit", count: null },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                <div className="flex items-center gap-2">
                  {action.count && (
                    <span className="text-[10px] font-semibold text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded-full">
                      {action.count}
                    </span>
                  )}
                  <ArrowRight size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
