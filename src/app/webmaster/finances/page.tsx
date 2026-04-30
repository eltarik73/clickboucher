// src/app/webmaster/finances/page.tsx
// Vue globale finances marketplace Klik&Go (admin)
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Coins,
  CreditCard,
  Sparkles,
  ShoppingBag,
  Trophy,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ShopTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type FinancesResponse = {
  month: {
    start: string;
    end: string;
    gmvCents: number;
    commissionOnlyCents: number;
    serviceFeeCents: number;
    platformFeeCents: number;
    stripeFeeCents: number;
    netProfitCents: number;
    orderCount: number;
  };
  topShops: Array<{
    shopId: string;
    name: string;
    slug: string;
    city: string;
    tier: ShopTier;
    gmvCents: number;
    platformFeeCents: number;
    payoutCents: number;
    orderCount: number;
  }>;
  tierDistribution: Record<ShopTier, number>;
  monthlyTrend: Array<{ month: string; gmv: number; commission: number; payout: number; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalCents: number;
    platformFeeCents: number;
    serviceFeeCents: number;
    stripeFeeCents: number;
    shopPayoutCents: number;
    paidAt: string | null;
    paymentMethod: string;
    shop: { id: string; name: string };
    customerName: string;
  }>;
  allShops: Array<{ id: string; name: string }>;
};

const TIER_INFO: Record<ShopTier, { label: string; emoji: string; color: string }> = {
  BRONZE: { label: "Bronze", emoji: "🥉", color: "text-amber-700 dark:text-amber-400" },
  SILVER: { label: "Argent", emoji: "🥈", color: "text-gray-600 dark:text-gray-300" },
  GOLD: { label: "Or", emoji: "🥇", color: "text-yellow-700 dark:text-yellow-400" },
  PLATINUM: { label: "Platine", emoji: "💎", color: "text-cyan-700 dark:text-cyan-400" },
};

const MONTH_NAMES = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtShort(cents: number): string {
  if (cents >= 100_000) return `${(cents / 100_000).toFixed(1)}k€`;
  return fmt(cents);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function WebmasterFinancesPage() {
  const [data, setData] = useState<FinancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterShopId, setFilterShopId] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterShopId
        ? `/api/webmaster/finances?shopId=${filterShopId}`
        : "/api/webmaster/finances";
      const res = await fetch(url);
      if (!res.ok) {
        toast.error("Impossible de charger les finances");
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [filterShopId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Données indisponibles</p>
      </div>
    );
  }

  const totalShops =
    data.tierDistribution.BRONZE +
    data.tierDistribution.SILVER +
    data.tierDistribution.GOLD +
    data.tierDistribution.PLATINUM;

  const monthLabel = new Date(data.month.start).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const trendChartData = data.monthlyTrend.map((m) => {
    const [, mo] = m.month.split("-");
    return {
      month: MONTH_NAMES[Number(mo)] || m.month,
      "CA (€)": Math.round(m.gmv / 100),
      "Commissions (€)": Math.round(m.commission / 100),
    };
  });

  const tierChartData = (Object.keys(data.tierDistribution) as ShopTier[]).map((tier) => ({
    tier: TIER_INFO[tier].label,
    count: data.tierDistribution[tier],
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Finances marketplace</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{monthLabel}</p>
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="CA total"
          value={fmtShort(data.month.gmvCents)}
          subValue={`${data.month.orderCount} cmd`}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          icon={<Coins className="w-4 h-4" />}
          label="Commissions %"
          value={fmtShort(data.month.commissionOnlyCents)}
          subValue="Klik&Go"
          color="text-[#DC2626]"
          bg="bg-red-50 dark:bg-red-950/30"
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4" />}
          label="Frais service"
          value={fmtShort(data.month.serviceFeeCents)}
          subValue="0,99 € × cmd"
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/30"
        />
        <StatCard
          icon={<CreditCard className="w-4 h-4" />}
          label="Frais Stripe"
          value={fmtShort(data.month.stripeFeeCents)}
          subValue="absorbés"
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
        />
        <StatCard
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Profit net"
          value={fmtShort(data.month.netProfitCents)}
          subValue="après Stripe"
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart (2 cols) */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Évolution 6 derniers mois
            </h2>
            <div className="h-56 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" }}
                    formatter={(v: number | string | undefined) => `${typeof v === "number" ? v.toLocaleString("fr-FR") : v ?? 0} €`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="CA (€)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Commissions (€)" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tier distribution */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Distribution paliers
            </h2>
            <div className="h-56 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                  <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="count" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-2">
              {totalShops} boutique{totalShops > 1 ? "s" : ""} active{totalShops > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top shops */}
      <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Top 10 boutiques (CA mois courant)
            </h2>
          </div>
          {data.topShops.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucune commande payée ce mois-ci.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Boutique</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold hidden sm:table-cell">Palier</th>
                    <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">CA</th>
                    <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold hidden md:table-cell">Cmd</th>
                    <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">Comm.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topShops.map((s, idx) => (
                    <tr key={s.shopId} className="border-t border-gray-100 dark:border-white/5">
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{s.city}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${TIER_INFO[s.tier].color}`}>
                          {TIER_INFO[s.tier].emoji} {TIER_INFO[s.tier].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900 dark:text-white">
                        {fmt(s.gmvCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {s.orderCount}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-[#DC2626]">
                        {fmt(s.platformFeeCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent orders + filter */}
      <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              50 dernières commandes
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterShopId}
                onChange={(e) => setFilterShopId(e.target.value)}
                className="text-xs h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] dark:text-white px-2"
              >
                <option value="">Toutes boutiques</option>
                {data.allShops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucune commande.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Date</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">N°</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Boutique</th>
                    <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold hidden md:table-cell">Client</th>
                    <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">Total</th>
                    <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">Comm.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="border-t border-gray-100 dark:border-white/5">
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {fmtDate(o.paidAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-900 dark:text-white">
                        #{o.orderNumber}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                        {o.shop.name}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {o.customerName}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-900 dark:text-white">
                        {fmt(o.totalCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-[#DC2626]">
                        {fmt(o.platformFeeCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
      <CardContent className="p-3 space-y-1">
        <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${bg} ${color}`}>
          {icon}
        </div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
          {label}
        </p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {subValue && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}
