"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  Users,
  ShoppingBag,
  Bell,
  Mail,
  Smartphone,
  Clock,
  CheckCircle,
  Eye,
  Package,
  Store,
  Star,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── types ─── */
interface DayData {
  date: string;
  revenue?: number;
  count?: number;
}
interface StatusData {
  status: string;
  count: number;
}
interface TopProduct {
  name: string;
  count: number;
  revenue: number;
}
interface TopShop {
  name: string;
  orders: number;
  revenue: number;
  rating: number;
}
interface WeekData {
  week: string;
  count: number;
}
interface ChannelData {
  channel: string;
  count: number;
}
interface TypeData {
  type: string;
  count: number;
}
interface NotifRecent {
  id: string;
  type: string;
  message: string;
  channel: string;
  read: boolean;
  delivered: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string } | null;
}

/* ─── helpers ─── */
const fmt = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const fmtShort = (cents: number) => {
  if (cents >= 10000000) return `${(cents / 100000).toFixed(0)}k€`;
  if (cents >= 100000) return `${(cents / 100000).toFixed(1)}k€`;
  return fmt(cents);
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-yellow-400" },
  ACCEPTED: { label: "Acceptée", color: "bg-blue-400" },
  PREPARING: { label: "En préparation", color: "bg-indigo-400" },
  READY: { label: "Prête", color: "bg-emerald-400" },
  PICKED_UP: { label: "Retirée", color: "bg-green-500" },
  COMPLETED: { label: "Terminée", color: "bg-green-600" },
  CANCELLED: { label: "Annulée", color: "bg-gray-400" },
  DENIED: { label: "Refusée", color: "bg-red-400" },
  AUTO_CANCELLED: { label: "Auto-annulée", color: "bg-red-300" },
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  EMAIL: { label: "Email", icon: Mail, color: "text-blue-600 dark:text-blue-400" },
  PUSH: { label: "Push", icon: Bell, color: "text-purple-600 dark:text-purple-400" },
  SMS: { label: "SMS", icon: Smartphone, color: "text-emerald-600 dark:text-emerald-400" },
  WHATSAPP: { label: "WhatsApp", icon: Smartphone, color: "text-green-600 dark:text-green-400" },
};

function shortDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function shortWeek(d: string) {
  const date = new Date(d);
  return `S${Math.ceil(date.getDate() / 7)}`;
}

/* ================================================================== */
export default function WebmasterAnalyticsPage() {
  /* ── Analytics state ── */
  const [revenueByDay, setRevenueByDay] = useState<DayData[]>([]);
  const [ordersByDay, setOrdersByDay] = useState<DayData[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<StatusData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topShops, setTopShops] = useState<TopShop[]>([]);
  const [userGrowth, setUserGrowth] = useState<WeekData[]>([]);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [avgPrepTime, setAvgPrepTime] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [denyRate, setDenyRate] = useState(0);

  /* ── Notification state ── */
  const [notifStats, setNotifStats] = useState<{
    total: number;
    last30d: number;
    last7d: number;
    deliveryRate: number;
    readRate: number;
    byChannel: ChannelData[];
    byType: TypeData[];
    dailyVolume: DayData[];
    recent: NotifRecent[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [showRecentNotifs, setShowRecentNotifs] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, notifRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/webmaster/notifications"),
      ]);
      const [aData, nData] = await Promise.all([analyticsRes.json(), notifRes.json()]);

      if (aData.success) {
        setRevenueByDay(aData.data.revenueByDay);
        setOrdersByDay(aData.data.ordersByDay);
        setOrdersByStatus(aData.data.ordersByStatus);
        setTopProducts(aData.data.topProducts);
        setTopShops(aData.data.topShops);
        setUserGrowth(aData.data.userGrowth);
        setAvgOrderValue(aData.data.avgOrderValue);
        setAvgPrepTime(aData.data.avgPrepTime);
        setMonthlyRevenue(aData.data.monthlyRevenue);
        setDenyRate(aData.data.denyRate);
      }

      if (nData.success) {
        setNotifStats(nData.data);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── chart helpers ── */
  const revMax = Math.max(1, ...revenueByDay.map((d) => d.revenue || 0));
  const ordMax = Math.max(1, ...ordersByDay.map((d) => d.count || 0));
  const totalStatusOrders = ordersByStatus.reduce((s, o) => s + o.count, 0);
  const userMax = Math.max(1, ...userGrowth.map((w) => w.count));
  const notifDayMax = notifStats ? Math.max(1, ...notifStats.dailyVolume.map((d) => d.count || 0)) : 1;
  const notifChannelTotal = notifStats ? notifStats.byChannel.reduce((s, c) => s + c.count, 0) : 1;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-fade-up">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={20} /> Analytics
          </h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 size={20} /> Analytics
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tendances, performances et notifications de la plateforme
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="CA ce mois" value={fmtShort(monthlyRevenue)} color="text-gray-900 dark:text-white" />
        <KpiCard icon={ShoppingBag} label="Panier moyen" value={fmt(avgOrderValue)} color="text-blue-600 dark:text-blue-400" />
        <KpiCard icon={Clock} label="Prep. moyenne" value={`${avgPrepTime} min`} color="text-amber-600 dark:text-amber-400" />
        <KpiCard icon={XCircle} label="Taux refus" value={`${(denyRate * 100).toFixed(1)}%`} color={denyRate > 0.05 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"} />
      </div>

      {/* Revenue + Orders charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue 30d */}
        <ChartCard title="CA 30 jours" icon={TrendingUp}>
          <div className="flex items-end gap-[2px] h-28">
            {revenueByDay.map((d, i) => (
              <div
                key={i}
                className="flex-1 bg-red-400 dark:bg-red-500 rounded-t-sm hover:bg-red-500 dark:hover:bg-red-400 transition-colors"
                style={{ height: `${Math.max(2, ((d.revenue || 0) / revMax) * 100)}%` }}
                title={`${shortDate(d.date)} · ${fmt(d.revenue || 0)}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 dark:text-gray-400 mt-1">
            <span>{shortDate(revenueByDay[0]?.date || "")}</span>
            <span>{shortDate(revenueByDay[revenueByDay.length - 1]?.date || "")}</span>
          </div>
        </ChartCard>

        {/* Orders 30d */}
        <ChartCard title="Commandes 30 jours" icon={ShoppingBag}>
          <div className="flex items-end gap-[2px] h-28">
            {ordersByDay.map((d, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-400 dark:bg-blue-500 rounded-t-sm hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors"
                style={{ height: `${Math.max(2, ((d.count || 0) / ordMax) * 100)}%` }}
                title={`${shortDate(d.date)} · ${d.count || 0} cmd`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 dark:text-gray-400 mt-1">
            <span>{shortDate(ordersByDay[0]?.date || "")}</span>
            <span>{shortDate(ordersByDay[ordersByDay.length - 1]?.date || "")}</span>
          </div>
        </ChartCard>
      </div>

      {/* Status distribution + User growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order status distribution */}
        <ChartCard title="Répartition statuts" icon={Package}>
          <div className="space-y-2">
            {ordersByStatus
              .sort((a, b) => b.count - a.count)
              .map((s) => {
                const cfg = STATUS_LABELS[s.status] || { label: s.status, color: "bg-gray-400" };
                const pct = totalStatusOrders > 0 ? (s.count / totalStatusOrders) * 100 : 0;
                return (
                  <div key={s.status} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.color} flex-shrink-0`} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">
                      {cfg.label}
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                      {s.count}
                    </span>
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden flex-shrink-0">
                      <div className={`h-full rounded-full ${cfg.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 w-8 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </ChartCard>

        {/* User growth */}
        <ChartCard title="Croissance utilisateurs (8 sem.)" icon={Users}>
          <div className="flex items-end gap-2 h-28">
            {userGrowth.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-400 dark:bg-emerald-500 rounded-t-md"
                  style={{ height: `${Math.max(4, (w.count / userMax) * 100)}%` }}
                />
                <span className="text-[9px] text-gray-500 dark:text-gray-400">{shortWeek(w.week)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Top products + Top shops */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top products */}
        <ChartCard title="Top 10 produits" icon={Package}>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-4">{i + 1}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                  {p.name}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{p.count} ventes</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white w-16 text-right">
                  {fmtShort(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top shops */}
        <ChartCard title="Top 5 boutiques" icon={Store}>
          <div className="space-y-2">
            {topShops.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-4">{i + 1}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                  {s.name}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                  <Star size={10} fill="currentColor" /> {s.rating.toFixed(1)}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{s.orders} cmd</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white w-16 text-right">
                  {fmtShort(s.revenue)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ═══════ NOTIFICATIONS SECTION ═══════ */}
      {notifStats && (
        <>
          <div className="mt-2">
            <h2 className="font-display text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell size={18} /> Notifications
            </h2>
          </div>

          {/* Notif KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Bell} label="Total 30j" value={String(notifStats.last30d)} color="text-purple-600 dark:text-purple-400" />
            <KpiCard icon={Zap} label="7 derniers jours" value={String(notifStats.last7d)} color="text-blue-600 dark:text-blue-400" />
            <KpiCard icon={CheckCircle} label="Taux envoi" value={`${notifStats.deliveryRate}%`} color="text-emerald-600 dark:text-emerald-400" />
            <KpiCard icon={Eye} label="Taux lecture" value={`${notifStats.readRate}%`} color="text-amber-600 dark:text-amber-400" />
          </div>

          {/* Notif charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily volume */}
            <ChartCard title="Volume 7 jours" icon={Bell}>
              <div className="flex items-end gap-2 h-24">
                {notifStats.dailyVolume.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-purple-400 dark:bg-purple-500 rounded-t-md"
                      style={{ height: `${Math.max(4, ((d.count || 0) / notifDayMax) * 100)}%` }}
                    />
                    <span className="text-[9px] text-gray-500 dark:text-gray-400">
                      {shortDate(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* By channel */}
            <ChartCard title="Par canal (30j)" icon={Mail}>
              <div className="space-y-2">
                {notifStats.byChannel.map((c) => {
                  const cfg = CHANNEL_CONFIG[c.channel] || { label: c.channel, icon: Bell, color: "text-gray-500 dark:text-gray-400" };
                  const ChannelIcon = cfg.icon;
                  const pct = notifChannelTotal > 0 ? (c.count / notifChannelTotal) * 100 : 0;
                  return (
                    <div key={c.channel} className="flex items-center gap-2">
                      <ChannelIcon size={14} className={cfg.color} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-16">
                        {cfg.label}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-400 dark:bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                        {c.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>

          {/* Top notification types */}
          <ChartCard title="Types de notifications (30j)" icon={Zap}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {notifStats.byType.map((t) => (
                <div
                  key={t.type}
                  className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-center"
                >
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {t.count}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={t.type}>
                    {t.type.replace(/_/g, " ").toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Recent notifications (collapsible) */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm">
            <button
              onClick={() => setShowRecentNotifs(!showRecentNotifs)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell size={14} /> Dernières notifications
              </h3>
              {showRecentNotifs ? (
                <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
              )}
            </button>
            {showRecentNotifs && (
              <div className="border-t border-gray-100 dark:border-white/[0.06] divide-y divide-gray-50 dark:divide-white/[0.03]">
                {notifStats.recent.map((n) => {
                  const chCfg = CHANNEL_CONFIG[n.channel] || CHANNEL_CONFIG.PUSH;
                  return (
                    <div key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {n.message}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {n.user ? `${n.user.firstName} ${n.user.lastName}` : "—"} ·{" "}
                          {n.type.replace(/_/g, " ").toLowerCase()} ·{" "}
                          {new Date(n.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium ${chCfg.color}`}>
                        {chCfg.label}
                      </span>
                      {n.delivered && (
                        <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                      )}
                      {n.read && (
                        <Eye size={12} className="text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

/* ================================================================== */
/* ── Chart Card ─── */
/* ================================================================== */
function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
        <Icon size={14} /> {title}
      </h3>
      {children}
    </div>
  );
}
