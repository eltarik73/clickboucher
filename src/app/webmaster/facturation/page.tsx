"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Coins,
  TrendingUp,
  Store,
  Receipt,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  ShoppingBag,
} from "lucide-react";

/* ─── types ─── */
interface PeriodData {
  label: string;
  start: string | null;
  revenueCents: number;
  commissionCents: number;
  netCents: number;
  orderCount: number;
}

interface AllTimeData {
  revenueCents: number;
  commissionCents: number;
  orderCount: number;
}

interface ShopRow {
  shopId: string;
  shopName: string;
  shopSlug: string;
  commissionPct: number;
  commissionEnabled: boolean;
  orderCount: number;
  revenueCents: number;
  commissionCents: number;
  netCents: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  commission: number;
  orders: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  commissionCents: number;
  status: string;
  createdAt: string;
  shop: { id: string; name: string };
  user: { firstName: string; lastName: string } | null;
}

/* ─── helpers ─── */
const fmt = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const fmtShort = (cents: number) => {
  if (cents >= 100000) return `${(cents / 100000).toFixed(1)}k€`;
  return fmt(cents);
};

const MONTH_NAMES = [
  "", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

function monthLabel(m: string) {
  const [, mo] = m.split("-");
  return MONTH_NAMES[Number(mo)] || m;
}

const PERIOD_OPTIONS = [
  { value: "week", label: "7 jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
];

/* ================================================================== */
export default function WebmasterFacturationPage() {
  const [period, setPeriod] = useState<PeriodData | null>(null);
  const [allTime, setAllTime] = useState<AllTimeData | null>(null);
  const [shopRows, setShopRows] = useState<ShopRow[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [shopsNoCommission, setShopsNoCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [shopSort, setShopSort] = useState<"commission" | "revenue" | "orders">("commission");
  const [showAllShops, setShowAllShops] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webmaster/billing?period=${selectedPeriod}`);
      const d = await res.json();
      if (d.success) {
        setPeriod(d.data.period);
        setAllTime(d.data.allTime);
        setShopRows(d.data.shopRows);
        setMonthlyTrend(d.data.monthlyTrend);
        setRecentOrders(d.data.recentOrders);
        setShopsNoCommission(d.data.shopsNoCommission);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── sorted shops ── */
  const sortedShops = [...shopRows].sort((a, b) => {
    if (shopSort === "revenue") return b.revenueCents - a.revenueCents;
    if (shopSort === "orders") return b.orderCount - a.orderCount;
    return b.commissionCents - a.commissionCents;
  });

  const displayShops = showAllShops ? sortedShops : sortedShops.slice(0, 10);

  /* ── chart max for bars ── */
  const trendMax = Math.max(1, ...monthlyTrend.map((m) => m.revenue));

  /* ── average commission % ── */
  const avgCommissionPct =
    period && period.revenueCents > 0
      ? ((period.commissionCents / period.revenueCents) * 100).toFixed(1)
      : "0";

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Coins size={20} /> Facturation & Commissions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Suivi des revenus et commissions de la plateforme
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                selectedPeriod === opt.value
                  ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert: shops without commission */}
      {shopsNoCommission > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{shopsNoCommission} boutique{shopsNoCommission > 1 ? "s" : ""}</strong> n&apos;ont pas de commission activée.
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={TrendingUp}
              label="CA période"
              value={fmt(period?.revenueCents || 0)}
              sub={`${period?.orderCount || 0} commandes`}
              color="text-gray-900 dark:text-white"
              bg="bg-gray-100 dark:bg-white/5"
            />
            <KpiCard
              icon={Coins}
              label="Commission période"
              value={fmt(period?.commissionCents || 0)}
              sub={`~${avgCommissionPct}% moy.`}
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-50 dark:bg-amber-500/10"
            />
            <KpiCard
              icon={Store}
              label="Net boutiques"
              value={fmt(period?.netCents || 0)}
              sub="Après commission"
              color="text-emerald-600 dark:text-emerald-400"
              bg="bg-emerald-50 dark:bg-emerald-500/10"
            />
            <KpiCard
              icon={Receipt}
              label="Commission totale"
              value={fmtShort(allTime?.commissionCents || 0)}
              sub={`${allTime?.orderCount || 0} cmd all-time`}
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-50 dark:bg-blue-500/10"
            />
          </div>

          {/* Monthly trend + Shop breakdown row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monthly trend chart */}
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <BarChart3 size={16} /> Tendance 6 mois
              </h2>
              <div className="flex items-end gap-2 h-32">
                {monthlyTrend.map((m) => {
                  const revH = trendMax > 0 ? (m.revenue / trendMax) * 100 : 0;
                  const comH = trendMax > 0 ? (m.commission / trendMax) * 100 : 0;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end h-24">
                        {/* Revenue bar */}
                        <div
                          className="w-full max-w-[28px] bg-gray-200 dark:bg-white/10 rounded-t-md relative"
                          style={{ height: `${Math.max(2, revH)}%` }}
                        >
                          {/* Commission overlay */}
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-amber-400 dark:bg-amber-500 rounded-t-md"
                            style={{ height: `${comH > 0 ? Math.max(2, (comH / Math.max(1, revH)) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{monthLabel(m.month)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-white/10" /> CA
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 dark:bg-amber-500" /> Commission
                </span>
              </div>
            </div>

            {/* Commission rate distribution */}
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Percent size={16} /> Taux par boutique
              </h2>
              {shopRows.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Aucune donnée</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sortedShops.slice(0, 8).map((s) => {
                    const pct =
                      s.revenueCents > 0
                        ? ((s.commissionCents / s.revenueCents) * 100).toFixed(1)
                        : "0";
                    return (
                      <div key={s.shopId} className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
                          {s.shopName}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {s.commissionPct}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, Number(pct) * 3)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-12 text-right flex-shrink-0">
                          {fmt(s.commissionCents)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Shop breakdown table */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Store size={16} /> Détail par boutique
              </h2>
              <div className="flex gap-1">
                {(["commission", "revenue", "orders"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShopSort(s)}
                    className={`px-2 py-1 text-[10px] rounded-lg transition ${
                      shopSort === s
                        ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                        : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {s === "commission" ? "Commission" : s === "revenue" ? "CA" : "Commandes"}
                  </button>
                ))}
              </div>
            </div>

            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_40px] gap-2 px-4 py-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/[0.06]">
              <span>Boutique</span>
              <span className="text-right">Taux</span>
              <span className="text-right">CA</span>
              <span className="text-right">Commission</span>
              <span className="text-right">Net</span>
              <span />
            </div>

            {displayShops.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Aucune commission sur cette période.
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {displayShops.map((shop) => (
                  <ShopBillingRow key={shop.shopId} shop={shop} />
                ))}
              </div>
            )}

            {sortedShops.length > 10 && (
              <button
                onClick={() => setShowAllShops(!showAllShops)}
                className="w-full py-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-1 border-t border-gray-100 dark:border-white/[0.06] transition"
              >
                {showAllShops ? (
                  <>
                    <ChevronUp size={14} /> Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Voir les {sortedShops.length} boutiques
                  </>
                )}
              </button>
            )}
          </div>

          {/* Recent commission orders */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt size={16} /> Dernières commissions
              </h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
              {recentOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  Aucune commande avec commission.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {order.shop.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {order.user
                          ? `${order.user.firstName} ${order.user.lastName}`
                          : "Client"}{" "}
                        ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {fmt(order.totalCents)}
                      </div>
                      <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        +{fmt(order.commissionCents)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* ── KPI Card ─── */
/* ================================================================== */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

/* ================================================================== */
/* ── Shop Billing Row ─── */
/* ================================================================== */
function ShopBillingRow({ shop }: { shop: ShopRow }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-[1fr_80px_100px_100px_100px_40px] gap-2 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
      {/* Shop name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {shop.shopName}
        </span>
        {!shop.commissionEnabled && (
          <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 flex-shrink-0">
            OFF
          </span>
        )}
      </div>

      {/* Rate */}
      <div className="text-right">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {shop.commissionPct}%
        </span>
      </div>

      {/* Revenue */}
      <div className="text-right">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {fmt(shop.revenueCents)}
        </span>
      </div>

      {/* Commission */}
      <div className="text-right">
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
          {fmt(shop.commissionCents)}
        </span>
      </div>

      {/* Net */}
      <div className="text-right hidden md:block">
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {fmt(shop.netCents)}
        </span>
      </div>

      {/* Link */}
      <div className="text-right hidden md:block">
        <a
          href={`/webmaster/boutiques/${shop.shopId}`}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
