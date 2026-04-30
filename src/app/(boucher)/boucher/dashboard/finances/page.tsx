// src/app/(boucher)/boucher/dashboard/finances/page.tsx
// Dashboard finances boucher : palier, commissions, payouts, graphique CA, dernières commandes
"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Coins,
  ShoppingBag,
  Sparkles,
  Download,
  ExternalLink,
  CreditCard,
  ArrowRight,
} from "lucide-react";

// Lazy-load recharts (~140KB) to keep finances page fast (audit P-05).
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ShopTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type FinancesResponse = {
  shop: {
    id: string;
    name: string;
    tier: ShopTier;
    commissionMarkupPercent: number;
    priceRoundingEnabled: boolean;
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
  };
  tierInfo: {
    tier: ShopTier;
    effectiveRate: number;
    baseRate: number;
    isEarlyAdopter: boolean;
    earlyAdopterUntil: string | null;
    earlyAdopterDaysRemaining: number;
    nextTier: ShopTier | null;
    nextTierMinCents: number | null;
    remainingToNextTierCents: number | null;
  };
  month: {
    start: string;
    end: string;
    gmvCents: number;
    commissionCents: number;
    stripeFeeCents: number;
    payoutCents: number;
    orderCount: number;
  };
  daily: Array<{ date: string; gmv: number; commission: number; payout: number; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalCents: number;
    platformFeeCents: number;
    serviceFeeCents: number;
    shopPayoutCents: number;
    paidAt: string | null;
    paymentMethod: string;
    customerName: string;
  }>;
};

// ─────────────────────────────────────────────
// Tier metadata
// ─────────────────────────────────────────────
const TIER_INFO: Record<
  ShopTier,
  { label: string; emoji: string; bg: string; ring: string; color: string }
> = {
  BRONZE: { label: "Bronze", emoji: "🥉", bg: "bg-amber-50 dark:bg-amber-950/30", ring: "ring-amber-300/40", color: "text-amber-700 dark:text-amber-400" },
  SILVER: { label: "Argent", emoji: "🥈", bg: "bg-gray-50 dark:bg-gray-900/40", ring: "ring-gray-300/40", color: "text-gray-700 dark:text-gray-300" },
  GOLD: { label: "Or", emoji: "🥇", bg: "bg-yellow-50 dark:bg-yellow-950/30", ring: "ring-yellow-300/40", color: "text-yellow-700 dark:text-yellow-400" },
  PLATINUM: { label: "Platine", emoji: "💎", bg: "bg-cyan-50 dark:bg-cyan-950/30", ring: "ring-cyan-300/40", color: "text-cyan-700 dark:text-cyan-400" },
};

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
export default function BoucherFinancesPage() {
  const [data, setData] = useState<FinancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/boucher/finances");
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function openStripeDashboard() {
    setOpening(true);
    try {
      const res = await fetch("/api/boucher/stripe/dashboard-link");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message || "Impossible d'ouvrir le dashboard Stripe");
        return;
      }
      const json = await res.json();
      if (json.data?.url) {
        window.open(json.data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setOpening(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const from = data.month.start.slice(0, 10);
    const to = data.month.end.slice(0, 10);
    window.open(`/api/boucher/finances/export?from=${from}&to=${to}`, "_blank");
  }

  if (loading) {
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

  const tierMeta = TIER_INFO[data.tierInfo.tier];
  const monthLabel = new Date(data.month.start).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Progress to next tier
  const progressPct = data.tierInfo.nextTierMinCents
    ? Math.min(100, (data.month.gmvCents / data.tierInfo.nextTierMinCents) * 100)
    : 100;

  // Chart data — pretty x-axis labels
  const chartData = data.daily.map((d) => ({
    date: d.date.slice(8, 10), // "DD"
    fullDate: d.date,
    "CA (€)": Math.round(d.gmv / 100),
    "Payout (€)": Math.round(d.payout / 100),
  }));

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Finances</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {data.shop.stripeChargesEnabled && (
              <Button
                onClick={openStripeDashboard}
                disabled={opening}
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
              >
                {opening ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Stripe</span>
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={exportCsv}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
            >
              <Download className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        </div>

        {/* Stripe Connect status — alert if not configured */}
        {!data.shop.stripeChargesEnabled && (
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Active les paiements en ligne
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Connecte ton compte Stripe pour encaisser via Klik&Go et profiter des versements automatiques.
                  </p>
                  <Link
                    href="/boucher/parametres/paiement"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626] hover:underline mt-2"
                  >
                    Configurer maintenant
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hero Tier Card */}
        <Card className={`bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden ring-2 ${tierMeta.ring}`}>
          <CardContent className={`p-5 ${tierMeta.bg}`}>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{tierMeta.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Palier actuel
                </p>
                <p className={`text-2xl font-bold ${tierMeta.color}`}>{tierMeta.label}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Commission : <span className="font-bold">{(data.tierInfo.effectiveRate * 100).toFixed(0)}%</span>
                  {data.tierInfo.isEarlyAdopter && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                      <Sparkles className="w-2.5 h-2.5" />
                      EARLY −2 PTS · {data.tierInfo.earlyAdopterDaysRemaining}j
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Progress to next tier */}
            {data.tierInfo.nextTier && data.tierInfo.remainingToNextTierCents !== null && (
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Encore <span className="font-bold text-gray-900 dark:text-white">{fmt(data.tierInfo.remainingToNextTierCents)}</span> pour
                    {" "}
                    {TIER_INFO[data.tierInfo.nextTier].emoji} {TIER_INFO[data.tierInfo.nextTier].label}
                  </p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {(progressPct).toFixed(0)}%
                  </p>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#DC2626] to-amber-500 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {data.tierInfo.tier === "PLATINUM" && (
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                <p className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold">
                  💎 Tu es au palier maximum. Bravo !
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="CA brut"
            value={fmtShort(data.month.gmvCents)}
            subValue={`${data.month.orderCount} cmd`}
            color="text-blue-600 dark:text-blue-400"
            bg="bg-blue-50 dark:bg-blue-950/30"
          />
          <StatCard
            icon={<Coins className="w-4 h-4" />}
            label="Commission"
            value={fmtShort(data.month.commissionCents)}
            subValue="dont 0,99 € × cmd"
            color="text-[#DC2626]"
            bg="bg-red-50 dark:bg-red-950/30"
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
            label="Versé"
            value={fmtShort(data.month.payoutCents)}
            subValue="reçu"
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-950/30"
          />
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Évolution du CA — {monthLabel}
              </h2>
              <div className="h-56 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-white/10" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" }}
                      formatter={((v: unknown) => `${v ?? 0} €`) as never}
                    />
                    <Bar dataKey="CA (€)" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Payout (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent orders */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                10 dernières commandes payées
              </h2>
            </div>
            {data.recentOrders.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aucune commande payée pour le moment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">N°</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Client</th>
                      <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">Total</th>
                      <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold hidden sm:table-cell">Comm.</th>
                      <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold">Versé</th>
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
                          {o.customerName}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-900 dark:text-white">
                          {fmt(o.totalCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-[#DC2626] hidden sm:table-cell">
                          −{fmt(o.platformFeeCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {fmt(o.shopPayoutCents)}
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat card component
// ─────────────────────────────────────────────
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
