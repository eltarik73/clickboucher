"use client";

import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, Clock, XCircle, Star } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load recharts to avoid SSR issues
const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

// ── Types ────────────────────────────────────────
type Analytics = {
  revenueByDay: { date: string; revenue: number }[];
  ordersByDay: { date: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
  topShops: { name: string; orders: number; revenue: number; rating: number }[];
  userGrowth: { week: string; count: number }[];
  avgOrderValue: number;
  avgPrepTime: number;
  monthlyRevenue: number;
  denyRate: number;
};

// ── Helpers ──────────────────────────────────────
function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtFull(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Accept\u00e9e",
  PREPARING: "Pr\u00e9paration",
  READY: "Pr\u00eate",
  PICKED_UP: "R\u00e9cup\u00e9r\u00e9e",
  COMPLETED: "Termin\u00e9e",
  DENIED: "Refus\u00e9e",
  CANCELLED: "Annul\u00e9e",
  PARTIALLY_DENIED: "Partielle",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  ACCEPTED: "#3b82f6",
  PREPARING: "#6366f1",
  READY: "#10b981",
  PICKED_UP: "#22c55e",
  COMPLETED: "#16a34a",
  DENIED: "#ef4444",
  CANCELLED: "#9ca3af",
  PARTIALLY_DENIED: "#f97316",
};

// ── Page Component ───────────────────────────────
export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-32">
        <p className="text-red-500 font-medium">Erreur de chargement</p>
      </div>
    );
  }

  const totalStatusOrders = data.ordersByStatus.reduce(
    (s, o) => s + o.count,
    0
  );
  const maxShopOrders = Math.max(...data.topShops.map((s) => s.orders), 1);
  const maxProductCount = Math.max(...data.topProducts.map((p) => p.count), 1);

  const chartData = data.revenueByDay.map((r, i) => ({
    date: shortDate(r.date),
    revenue: r.revenue / 100,
    orders: data.ordersByDay[i]?.count || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Analytics
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Performances et statistiques de la plateforme
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "CA mensuel",
            value: fmt(data.monthlyRevenue) + " \u20ac",
            icon: DollarSign,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-500/10",
          },
          {
            label: "Panier moyen",
            value: fmtFull(data.avgOrderValue) + " \u20ac",
            icon: ShoppingCart,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-500/10",
          },
          {
            label: "Traitement moy.",
            value: data.avgPrepTime > 0 ? `${data.avgPrepTime} min` : "\u2014",
            icon: Clock,
            color: "text-violet-600 dark:text-violet-400",
            bg: "bg-violet-50 dark:bg-violet-500/10",
          },
          {
            label: "Taux de refus",
            value: (data.denyRate * 100).toFixed(1) + " %",
            icon: XCircle,
            color:
              data.denyRate > 0.1
                ? "text-red-600 dark:text-red-400"
                : "text-gray-600 dark:text-gray-400",
            bg:
              data.denyRate > 0.1
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-gray-50 dark:bg-[#3a3530]",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={16} className={kpi.color} />
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

      {/* Revenue chart */}
      <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3] mb-4">
          Revenus \u2014 30 derniers jours
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v: number) => `${v}\u20ac`}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [`${Number(value).toFixed(2)} \u20ac`, "Revenus"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#DC2626"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders chart */}
      <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3] mb-4">
          Commandes par jour
        </h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [String(value), "Commandes"]}
              />
              <Bar dataKey="orders" fill="#DC2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Status breakdown */}
        <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3530]">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
              R\u00e9partition par statut
            </h2>
          </div>
          <div className="p-5 space-y-3">
            {data.ordersByStatus
              .sort((a, b) => b.count - a.count)
              .map((s) => {
                const pct =
                  totalStatusOrders > 0
                    ? (s.count / totalStatusOrders) * 100
                    : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {s.count} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-[#3a3530] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            STATUS_COLORS[s.status] || "#9ca3af",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* User growth */}
        <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3530]">
            <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
              Nouveaux utilisateurs (8 semaines)
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-32">
              {data.userGrowth.map((w) => {
                const maxCount = Math.max(
                  ...data.userGrowth.map((x) => x.count),
                  1
                );
                const h = (w.count / maxCount) * 100;
                return (
                  <div
                    key={w.week}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                      {w.count}
                    </span>
                    <div
                      className="w-full bg-[#DC2626]/80 rounded-t transition-all"
                      style={{ height: `${Math.max(h, 4)}%` }}
                    />
                    <span className="text-[9px] text-gray-400">
                      {shortDate(w.week)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 products */}
      <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3530]">
          <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
            Top 10 Produits
          </h2>
        </div>
        {data.topProducts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Aucune donn\u00e9e disponible.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-[#3a3530]">
                  <th className="px-5 py-3 font-medium w-8">#</th>
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Commandes
                  </th>
                  <th className="px-4 py-3 font-medium">Popularit\u00e9</th>
                  <th className="px-4 py-3 font-medium text-right">Revenus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#3a3530]">
                {data.topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td className="px-5 py-3 text-gray-400 dark:text-gray-500 font-medium">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {p.count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full h-2 bg-gray-100 dark:bg-[#3a3530] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#DC2626] rounded-full"
                          style={{
                            width: `${(p.count / maxProductCount) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {fmtFull(p.revenue)} \u20ac
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top 5 shops */}
      <div className="bg-white dark:bg-[#2a2520] rounded-xl border border-gray-100 dark:border-[#3a3530] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#3a3530]">
          <h2 className="font-semibold text-gray-900 dark:text-[#f8f6f3]">
            Top 5 Boucheries
          </h2>
        </div>
        {data.topShops.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Aucune donn\u00e9e disponible.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-[#3a3530]">
                  <th className="px-5 py-3 font-medium w-8">#</th>
                  <th className="px-4 py-3 font-medium">Boucherie</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Commandes
                  </th>
                  <th className="px-4 py-3 font-medium">Part</th>
                  <th className="px-4 py-3 font-medium text-right">Revenus</th>
                  <th className="px-4 py-3 font-medium text-right">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#3a3530]">
                {data.topShops.map((s, i) => (
                  <tr key={s.name}>
                    <td className="px-5 py-3 text-gray-400 dark:text-gray-500 font-medium">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {s.orders}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full h-2 bg-gray-100 dark:bg-[#3a3530] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#DC2626] rounded-full"
                          style={{
                            width: `${(s.orders / maxShopOrders) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                      {fmtFull(s.revenue)} \u20ac
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                        <Star size={12} fill="currentColor" />
                        {s.rating.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
