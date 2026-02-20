// src/app/(boucher)/boucher/dashboard/statistiques/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Users,
  Clock,
  Crown,
  BarChart3,
  Loader2,
  AlertCircle,
  CheckCircle,
  Percent,
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load recharts (identical pattern to admin/analytics)
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
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

// ─────────────────────────────────────────────
// Types (matching flat API response)
// ─────────────────────────────────────────────
type Period = "week" | "month" | "year";

type StatsData = {
  // Basic (all plans)
  plan: "STARTER" | "PRO" | "PREMIUM";
  period: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  rating: number;
  ratingCount: number;
  completionRate: number;
  ordersToday: number;
  // Advanced (PRO+)
  revenueChart?: { date: string; revenue: number }[];
  ordersChart?: { date: string; orders: number }[];
  hourlyDistribution?: { hour: number; orders: number }[];
  topProducts?: { name: string; quantity: number; revenue: number }[];
  topClients?: { name: string; orderCount: number; totalSpent: number }[];
  avgPrepTime?: number;
  // Premium
  offPeakHours?: number[];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function centsToEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function centsToEuroShort(cents: number): string {
  const eur = cents / 100;
  if (eur >= 1000) return (eur / 1000).toFixed(1).replace(".", ",") + "k\u20AC";
  return eur.toFixed(0) + " \u20AC";
}

// ─────────────────────────────────────────────
// Custom Tooltips
// ─────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {centsToEuro(payload[0].value)}
      </p>
    </div>
  );
}

function OrdersTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}h</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {payload[0].value} commande{payload[0].value > 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Period Tabs
// ─────────────────────────────────────────────
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Ann\u00E9e" },
];

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────
export default function StatistiquesPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-promos state (PREMIUM only)
  const [autoPromos, setAutoPromos] = useState<{ enabled: boolean } | null>(null);
  const [autoPromosLoading, setAutoPromosLoading] = useState(false);

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boucher/stats?period=${p}`);
      if (!res.ok) throw new Error("Erreur serveur");
      const json = await res.json();
      setStats(json.data);
    } catch {
      setError("Impossible de charger les statistiques");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAutoPromos = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/stats/auto-promos");
      if (res.ok) {
        const json = await res.json();
        setAutoPromos(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  async function toggleAutoPromos(enabled: boolean) {
    setAutoPromosLoading(true);
    try {
      const res = await fetch("/api/boucher/stats/auto-promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const json = await res.json();
        setAutoPromos(json.data);
      }
    } catch {
      // silent
    } finally {
      setAutoPromosLoading(false);
    }
  }

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  useEffect(() => {
    if (stats?.plan === "PREMIUM") {
      fetchAutoPromos();
    }
  }, [stats?.plan, fetchAutoPromos]);

  // Derived
  const plan = stats?.plan || "STARTER";
  const hasAdvanced = plan === "PRO" || plan === "PREMIUM";
  const hasPremium = plan === "PREMIUM";

  // Loading
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  // Error
  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-5 py-6">
          <Link
            href="/boucher/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
          >
            <ArrowLeft size={16} /> Retour
          </Link>
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchStats(period)} className="mt-2">
              R&eacute;essayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/boucher/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Statistiques</h1>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold uppercase ${
              plan === "PREMIUM"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                : plan === "PRO"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800"
                : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10"
            }`}
          >
            <Crown size={10} className="mr-1" />
            {plan}
          </Badge>
        </div>

        {/* ── Period Selector ── */}
        <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 border border-gray-200 dark:border-white/10">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                period === p.key
                  ? "bg-[#DC2626] text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Loading overlay for period change ── */}
        {loading && stats && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#DC2626]" />
          </div>
        )}

        {/* ── Basic Stats Grid 2x2 ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">CA total</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {centsToEuro(stats.totalRevenue)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Commandes</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalOrders}</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Panier moyen</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {centsToEuro(stats.avgOrderValue)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Taux completion</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.completionRate}%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Advanced Stats (PRO / PREMIUM) ── */}
        {hasAdvanced && stats?.revenueChart && (
          <div className="space-y-5">

            {/* ── Revenue Chart ── */}
            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Chiffre d&apos;affaires
                  </h3>
                  <TrendingUp size={14} className="text-gray-400" />
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.revenueChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => centsToEuroShort(v)}
                        width={45}
                      />
                      <Tooltip content={<RevenueTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#DC2626"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#DC2626", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* ── Orders Chart ── */}
            <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Commandes
                  </h3>
                  <ShoppingBag size={14} className="text-gray-400" />
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.ordersChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip content={<OrdersTooltip />} />
                      <Bar dataKey="orders" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* ── Hourly Distribution ── */}
            {stats.hourlyDistribution && (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      R&eacute;partition horaire
                    </h3>
                    <Clock size={14} className="text-gray-400" />
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.hourlyDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}h`}
                        />
                        <YAxis
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={25}
                        />
                        <Tooltip content={<OrdersTooltip />} />
                        <Bar dataKey="orders" fill="#DC2626" radius={[3, 3, 0, 0]} maxBarSize={24} opacity={0.85} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Top Products ── */}
            {stats.topProducts && stats.topProducts.length > 0 && (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top produits</h3>
                    <BarChart3 size={14} className="text-gray-400" />
                  </div>
                  <div className="space-y-3">
                    {stats.topProducts.map((product, i) => {
                      const maxRev = stats.topProducts![0]?.revenue || 1;
                      const pct = (product.revenue / maxRev) * 100;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                              {i + 1}. {product.name}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{product.quantity} vendus</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {centsToEuro(product.revenue)}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#DC2626] rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Top Clients ── */}
            {stats.topClients && stats.topClients.length > 0 && (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top clients</h3>
                    <Users size={14} className="text-gray-400" />
                  </div>
                  <div className="space-y-2.5">
                    {stats.topClients.map((client, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#DC2626]">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {client.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {client.orderCount} commande{client.orderCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                          {centsToEuro(client.totalSpent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Avg Prep Time ── */}
            {stats.avgPrepTime && stats.avgPrepTime > 0 && (
              <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Temps de preparation moyen</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.avgPrepTime} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── PREMIUM: Off-Peak Promos ── */}
        {hasPremium && stats?.offPeakHours && (
          <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Promos heures creuses
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                >
                  PREMIUM
                </Badge>
              </div>

              {stats.offPeakHours.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Heures creuses identifiees :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.offPeakHours.map((hour) => (
                      <Badge
                        key={hour}
                        variant="outline"
                        className="text-xs bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                      >
                        {hour}h
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  Pas assez de donnees pour identifier les heures creuses.
                </p>
              )}

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Promos automatiques
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    -10% sur les produits vedettes pendant les heures creuses
                  </p>
                </div>
                <Switch
                  checked={autoPromos?.enabled ?? false}
                  onCheckedChange={toggleAutoPromos}
                  disabled={autoPromosLoading || stats.offPeakHours.length === 0}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Upsell Banner (STARTER only) ── */}
        {plan === "STARTER" && (
          <Link href="/boucher/dashboard/abonnement">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#DC2626] to-[#991b1b] p-5 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-white" />
                  <span className="text-sm font-bold text-white">Plan Pro</span>
                </div>
                <p className="text-white/90 text-sm leading-relaxed mb-3">
                  Passez au plan Pro pour debloquer les statistiques avancees : graphiques de revenus, distribution horaire, top produits et clients.
                </p>
                <div className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-white text-sm font-medium">
                  Decouvrir les offres
                  <ArrowLeft size={14} className="rotate-180" />
                </div>
              </div>
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}
