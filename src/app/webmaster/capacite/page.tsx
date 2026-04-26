"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Clock,
  Store,
  AlertTriangle,
  Pause,
  Play,
  Sun,
  Flame,
  Eye,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Shield,
  Coffee,
  Palmtree,
  XCircle,
  Settings,
  TrendingUp,
} from "lucide-react";

/* ─── types ─── */
interface ShopCapacity {
  id: string;
  name: string;
  slug: string;
  status: string;
  busyMode: boolean;
  busyExtraMin: number;
  busyModeEndsAt: string | null;
  paused: boolean;
  pauseReason: string | null;
  pauseEndsAt: string | null;
  autoPaused: boolean;
  autoPausedAt: string | null;
  autoPauseThreshold: number;
  missedOrdersCount: number;
  vacationMode: boolean;
  vacationStart: string | null;
  vacationEnd: string | null;
  vacationMessage: string | null;
  prepTimeMin: number;
  maxOrdersPerSlot: number;
  maxOrdersPerHour: number;
  autoBusyThreshold: number;
  pickupSlots: PickupSlotsConfig | null;
  productCount: number;
  todayOrders: number;
  peakHourOrders: number;
  peakHour: number | null;
  capacityPct: number;
}

interface PickupSlotsConfig {
  intervalMin: number;
  maxPerSlot: number;
  slots: Record<string, { start: string; end: string }>;
}

interface CalendarEvent {
  id: string;
  name: string;
  description: string | null;
  date: string;
  type: string;
  emoji: string | null;
  alertDaysBefore: number;
  active: boolean;
}

/* ─── helpers ─── */
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Store }> = {
  OPEN:        { label: "Ouvert",      color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400", icon: Store },
  BUSY:        { label: "Occupé",      color: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",     icon: Flame },
  PAUSED:      { label: "En pause",    color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",     icon: Pause },
  AUTO_PAUSED: { label: "Auto-pause",  color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",                 icon: AlertTriangle },
  VACATION:    { label: "Vacances",    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",             icon: Palmtree },
  CLOSED:      { label: "Fermé",       color: "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400",                icon: XCircle },
};

const DAY_LABELS: Record<string, string> = {
  lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu",
  vendredi: "Ven", samedi: "Sam", dimanche: "Dim",
};

const DAY_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const EVENT_EMOJIS: Record<string, string> = {
  fermeture: "🔒",
  promo: "🏷️",
  evenement: "📅",
  fete: "🎉",
};

function relativeDate(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return `Dans ${diff} jours`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* ================================================================== */
export default function WebmasterCapacitePage() {
  const [shops, setShops] = useState<ShopCapacity[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [totalOrdersToday, setTotalOrdersToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "orders" | "capacity">("capacity");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webmaster/capacity");
      const d = await res.json();
      if (d.success) {
        setShops(d.data.shops);
        setStatusCounts(d.data.statusCounts);
        setCalendarEvents(d.data.calendarEvents);
        setTotalOrdersToday(d.data.totalOrdersToday);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [fetchData]);

  /* ── filter & sort ── */
  const filtered = shops
    .filter((s) => !statusFilter || s.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "orders") return b.todayOrders - a.todayOrders;
      if (sortBy === "capacity") return b.capacityPct - a.capacityPct;
      return a.name.localeCompare(b.name);
    });

  /* ── alerts: shops at >80% capacity or in trouble ── */
  const alerts = shops.filter(
    (s) =>
      s.capacityPct >= 80 ||
      s.status === "AUTO_PAUSED" ||
      s.missedOrdersCount > 0
  );

  /* ── status pill counts ── */
  const statusPills = [
    { value: "", label: "Toutes", count: shops.length },
    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
      count: statusCounts[key] || 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock size={20} /> Capacité & Créneaux
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Suivi en temps réel de la charge des boutiques
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition"
        >
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Store}
          label="Boutiques actives"
          value={shops.length}
          color="text-gray-700 dark:text-gray-300"
        />
        <KpiCard
          icon={Zap}
          label="Commandes aujourd'hui"
          value={totalOrdersToday}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Alertes capacité"
          value={alerts.length}
          color={alerts.length > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}
        />
        <KpiCard
          icon={Palmtree}
          label="En vacances / pause"
          value={(statusCounts["VACATION"] || 0) + (statusCounts["PAUSED"] || 0) + (statusCounts["AUTO_PAUSED"] || 0)}
          color="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            <AlertTriangle size={16} /> Alertes ({alerts.length})
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">{s.name}</span>
                <span>
                  {s.status === "AUTO_PAUSED" && "Auto-pause activée"}
                  {s.capacityPct >= 80 && s.status !== "AUTO_PAUSED" && `${s.capacityPct}% capacité`}
                  {s.missedOrdersCount > 0 && s.status !== "AUTO_PAUSED" && s.capacityPct < 80 && `${s.missedOrdersCount} commande(s) manquée(s)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter pills + sort */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {statusPills.map((pill) => (
            <button
              key={pill.value}
              onClick={() => setStatusFilter(pill.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                statusFilter === pill.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["capacity", "orders", "name"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                sortBy === s
                  ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
              }`}
            >
              {s === "capacity" ? "Charge" : s === "orders" ? "Commandes" : "Nom"}
            </button>
          ))}
        </div>
      </div>

      {/* Shop cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-12 text-center">
          <Store size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Aucune boutique avec ce filtre.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((shop) => (
            <ShopCapacityCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}

      {/* Calendar events */}
      {calendarEvents.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4 mt-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Calendar size={16} /> Événements à venir (30j)
          </h2>
          <div className="space-y-2">
            {calendarEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800"
              >
                <span className="text-lg">
                  {evt.emoji || EVENT_EMOJIS[evt.type] || "📅"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {evt.name}
                  </div>
                  {evt.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {evt.description}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatDate(evt.date)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {relativeDate(evt.date)}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                    evt.type === "fermeture"
                      ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                      : evt.type === "promo"
                        ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                  }`}
                >
                  {evt.type}
                </span>
              </div>
            ))}
          </div>
        </div>
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
  icon: typeof Store;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

/* ================================================================== */
/* ── Shop Capacity Card ─── */
/* ================================================================== */
function ShopCapacityCard({ shop }: { shop: ShopCapacity }) {
  const [expanded, setExpanded] = useState(false);

  const stCfg = STATUS_CONFIG[shop.status] || STATUS_CONFIG.OPEN;
  const StatusIcon = stCfg.icon;

  // Capacity bar color
  const barColor =
    shop.capacityPct >= 90
      ? "bg-red-500"
      : shop.capacityPct >= 70
        ? "bg-orange-500"
        : shop.capacityPct >= 40
          ? "bg-amber-400"
          : "bg-emerald-500";

  // Parse pickup slots config
  const slotsCfg = shop.pickupSlots as PickupSlotsConfig | null;

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
      >
        {/* Status icon */}
        <div className={`p-2 rounded-xl ${stCfg.color}`}>
          <StatusIcon size={16} />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {shop.name}
            </h3>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${stCfg.color}`}>
              {stCfg.label}
            </span>
            {shop.busyMode && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400">
                +{shop.busyExtraMin}min
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{shop.todayOrders} cmd aujourd&apos;hui</span>
            <span>·</span>
            <span>Prep: {shop.prepTimeMin}min</span>
            <span>·</span>
            <span>Max: {shop.maxOrdersPerHour}/h</span>
          </div>
        </div>

        {/* Capacity gauge */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-24">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-gray-500 dark:text-gray-400">Charge</span>
              <span className="font-bold text-gray-700 dark:text-gray-300">
                {shop.capacityPct}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, shop.capacityPct)}%` }}
              />
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" /> : <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Capacity settings */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Settings size={12} /> Configuration
              </h4>
              <div className="space-y-1.5 text-xs">
                <DetailRow label="Prep. de base" value={`${shop.prepTimeMin} min`} />
                <DetailRow label="Max / créneau" value={`${shop.maxOrdersPerSlot} cmd`} />
                <DetailRow label="Max / heure" value={`${shop.maxOrdersPerHour} cmd`} />
                <DetailRow label="Seuil auto-busy" value={`${shop.autoBusyThreshold} cmd`} />
                <DetailRow label="Seuil auto-pause" value={`${shop.autoPauseThreshold} manquées`} />
                <DetailRow label="Cmd manquées" value={`${shop.missedOrdersCount}`} warn={shop.missedOrdersCount > 0} />
                {slotsCfg && (
                  <>
                    <DetailRow label="Intervalle" value={`${slotsCfg.intervalMin} min`} />
                    <DetailRow label="Max / slot" value={`${slotsCfg.maxPerSlot} cmd`} />
                  </>
                )}
              </div>
            </div>

            {/* Status detail */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Eye size={12} /> Statut actuel
              </h4>
              <div className="space-y-1.5 text-xs">
                {shop.busyMode && (
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10">
                    <div className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1">
                      <Flame size={12} /> Mode occupé
                    </div>
                    <div className="text-orange-600 dark:text-orange-400/80 mt-0.5">
                      +{shop.busyExtraMin}min prep
                      {shop.busyModeEndsAt && ` · Expire ${formatTime(shop.busyModeEndsAt)}`}
                    </div>
                  </div>
                )}
                {shop.paused && (
                  <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10">
                    <div className="font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                      <Pause size={12} /> Pause manuelle
                    </div>
                    {shop.pauseReason && (
                      <div className="text-yellow-600 dark:text-yellow-400/80 mt-0.5">
                        {shop.pauseReason}
                      </div>
                    )}
                    {shop.pauseEndsAt && (
                      <div className="text-yellow-600 dark:text-yellow-400/80 mt-0.5">
                        Reprend : {formatTime(shop.pauseEndsAt)}
                      </div>
                    )}
                  </div>
                )}
                {shop.autoPaused && (
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                    <div className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> Auto-pause
                    </div>
                    <div className="text-red-600 dark:text-red-400/80 mt-0.5">
                      {shop.missedOrdersCount} commande(s) manquée(s) · Seuil: {shop.autoPauseThreshold}
                    </div>
                    {shop.autoPausedAt && (
                      <div className="text-red-600/60 dark:text-red-400/50 mt-0.5">
                        Depuis {formatTime(shop.autoPausedAt)}
                      </div>
                    )}
                  </div>
                )}
                {shop.vacationMode && (
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <div className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                      <Palmtree size={12} /> Mode vacances
                    </div>
                    <div className="text-blue-600 dark:text-blue-400/80 mt-0.5">
                      {shop.vacationStart && formatDate(shop.vacationStart)} → {shop.vacationEnd && formatDate(shop.vacationEnd)}
                    </div>
                    {shop.vacationMessage && (
                      <div className="text-blue-500 dark:text-blue-400/60 mt-0.5 italic">
                        &ldquo;{shop.vacationMessage}&rdquo;
                      </div>
                    )}
                  </div>
                )}
                {!shop.busyMode && !shop.paused && !shop.autoPaused && !shop.vacationMode && shop.status === "OPEN" && (
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Play size={12} /> Fonctionnement normal
                    </div>
                  </div>
                )}
                {shop.peakHour !== null && shop.peakHourOrders > 0 && (
                  <DetailRow
                    label="Pic aujourd'hui"
                    value={`${shop.peakHourOrders} cmd à ${shop.peakHour}h`}
                    warn={shop.capacityPct >= 80}
                  />
                )}
              </div>
            </div>

            {/* Pickup slots schedule */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Créneaux de retrait
              </h4>
              {slotsCfg && slotsCfg.slots ? (
                <div className="space-y-1">
                  {DAY_ORDER.map((day) => {
                    const slot = slotsCfg.slots[day];
                    return (
                      <div
                        key={day}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-500 dark:text-gray-400 w-8">
                          {DAY_LABELS[day]}
                        </span>
                        {slot ? (
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {slot.start} – {slot.end}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">Fermé</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Non configuré
                </p>
              )}
            </div>
          </div>

          {/* Shop link */}
          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.06] flex gap-2">
            <a
              href={`/webmaster/boutiques/${shop.id}`}
              className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <TrendingUp size={12} /> Voir la fiche boutique
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Detail row ─── */
function DetailRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`font-medium ${
          warn
            ? "text-red-600 dark:text-red-400"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
