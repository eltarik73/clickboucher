"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Percent,
  Zap,
  Tag,
  Gift,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Store,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

/* ─── Types ─── */
interface PromoProduct {
  id: string;
  name: string;
  priceCents: number;
  promoPct: number;
  promoType: string | null;
  promoEnd: string | null;
  inStock: boolean;
  imageUrl: string | null;
  shop: { id: string; name: string };
  category: { id: string; name: string } | null;
}

interface PerShop {
  shopId: string;
  shopName: string;
  activePromos: number;
  avgDiscount: number;
}

interface CalendarEvent {
  id: string;
  name: string;
  description: string | null;
  date: string;
  type: string;
  emoji: string | null;
  alertDaysBefore: number;
  suggestedProducts: string[] | null;
}

interface Stats {
  totalActive: number;
  totalFlash: number;
  totalPercentage: number;
  totalBuyXGetY: number;
  avgDiscount: number;
  expiringSoon: number;
}

/* ─── Helpers ─── */
function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20ac";
}
function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expirée";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h restantes`;
  const days = Math.floor(hours / 24);
  return `${days}j restants`;
}
function daysUntilEvent(dateStr: string) {
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86_400_000
  );
  if (diff < 0) return "En cours";
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return `Dans ${diff} jours`;
}

const PROMO_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  FLASH: { label: "Flash", color: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400" },
  PERCENTAGE: { label: "Pourcentage", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
  BUY_X_GET_Y: { label: "X+Y", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400" },
};

const EVENT_TYPE_STYLES: Record<string, { bg: string; border: string }> = {
  ramadan: { bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-500/20" },
  aid: { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  "aid-adha": { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  mawlid: { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" },
  promo: { bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/20" },
  fete: { bg: "bg-pink-50 dark:bg-pink-500/10", border: "border-pink-200 dark:border-pink-500/20" },
};

/* ================================================================== */
export default function WebmasterPromosPage() {
  const [loading, setLoading] = useState(true);
  const [promos, setPromos] = useState<PromoProduct[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [perShop, setPerShop] = useState<PerShop[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [sortBy, setSortBy] = useState("discount_desc");

  // UI
  const [showShopBreakdown, setShowShopBreakdown] = useState(false);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        status: statusFilter,
        sort: sortBy,
      });
      if (typeFilter) params.set("promoType", typeFilter);
      if (shopFilter) params.set("shopId", shopFilter);

      const res = await fetch(`/api/webmaster/promos?${params}`);
      const d = await res.json();
      if (d.success) {
        setPromos(d.data.promos);
        setStats(d.data.stats);
        setPerShop(d.data.perShop);
        setCalendarEvents(d.data.calendarEvents);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, shopFilter, sortBy]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  // Client-side search filter
  const filtered = search
    ? promos.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.shop.name.toLowerCase().includes(search.toLowerCase())
      )
    : promos;

  const statPills = stats
    ? [
        { label: "Actives", value: stats.totalActive, icon: Tag, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
        { label: "Flash", value: stats.totalFlash, icon: Zap, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
        { label: "Remise %", value: stats.totalPercentage, icon: Percent, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { label: "X+Y", value: stats.totalBuyXGetY, icon: Gift, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* ── Header ── */}
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Percent size={20} /> Promos & Ramadan
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Toutes les promotions actives et les événements calendrier
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 1: KPIs */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statPills.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={`${s.bg} rounded-2xl p-3.5 flex items-center gap-3`}
              >
                <Icon size={18} className={s.color} />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {s.value}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {s.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra KPIs row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <Percent size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                -{stats.avgDiscount}%
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Remise moyenne
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <Clock size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {stats.expiringSoon}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Expirent dans 48h
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <Store size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {perShop.length}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Boutiques avec promos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 2: Calendar Events / Ramadan */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {calendarEvents.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2">
            <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Événements à venir
            </h2>
            <span className="ml-auto text-xs text-gray-400">
              {calendarEvents.length} événement{calendarEvents.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {calendarEvents.map((evt) => {
              const style = EVENT_TYPE_STYLES[evt.type] || {
                bg: "bg-gray-50 dark:bg-white/[0.02]",
                border: "border-gray-200 dark:border-white/[0.06]",
              };
              const isPast = new Date(evt.date).getTime() < Date.now();
              const daysLabel = daysUntilEvent(evt.date);
              const isUrgent =
                !isPast &&
                (new Date(evt.date).getTime() - Date.now()) / 86_400_000 <= 7;

              return (
                <div
                  key={evt.id}
                  className={`${style.bg} border ${style.border} rounded-xl p-4 transition ${
                    isPast ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{evt.emoji || "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {evt.name}
                        </h3>
                        {isUrgent && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={10} /> Bientôt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(evt.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {" \u00b7 "}
                        <span className={isUrgent ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                          {daysLabel}
                        </span>
                      </p>
                      {evt.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {evt.description}
                        </p>
                      )}
                      {evt.suggestedProducts &&
                        Array.isArray(evt.suggestedProducts) &&
                        evt.suggestedProducts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Sparkles
                              size={12}
                              className="text-amber-500 mt-0.5"
                            />
                            {(evt.suggestedProducts as string[]).slice(0, 5).map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-white/60 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                              >
                                {p}
                              </span>
                            ))}
                            {evt.suggestedProducts.length > 5 && (
                              <span className="text-[10px] text-gray-400">
                                +{evt.suggestedProducts.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 3: Per-shop breakdown */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {perShop.length > 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowShopBreakdown((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
          >
            <Store size={16} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white flex-1">
              Promos par boutique
            </span>
            <span className="text-xs text-gray-400 mr-2">
              {perShop.length} boutique{perShop.length > 1 ? "s" : ""}
            </span>
            {showShopBreakdown ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          {showShopBreakdown && (
            <div className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/[0.06]">
                      <th className="pb-2 font-medium">Boutique</th>
                      <th className="pb-2 font-medium text-center">Promos actives</th>
                      <th className="pb-2 font-medium text-center">Remise moy.</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {perShop.map((s) => (
                      <tr key={s.shopId} className="group">
                        <td className="py-2.5 font-medium text-gray-900 dark:text-white">
                          {s.shopName}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                            {s.activePromos}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-300">
                          -{s.avgDiscount}%
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setShopFilter(s.shopId);
                              setPage(1);
                            }}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline opacity-0 group-hover:opacity-100 transition"
                          >
                            Voir les promos
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 4: Promos list */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-white/[0.06] space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher un produit ou boutique..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="discount_desc">Remise la plus haute</option>
              <option value="discount_asc">Remise la plus basse</option>
              <option value="newest">Plus récentes</option>
              <option value="ending_soon">Fin prochaine</option>
            </select>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status */}
            {["active", "expired", "all"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  statusFilter === s
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {s === "active" ? "Actives" : s === "expired" ? "Expirées" : "Toutes"}
              </button>
            ))}

            <span className="w-px h-5 bg-gray-200 dark:bg-white/10" />

            {/* Type */}
            {[
              { value: "", label: "Tous types" },
              { value: "FLASH", label: "Flash" },
              { value: "PERCENTAGE", label: "%" },
              { value: "BUY_X_GET_Y", label: "X+Y" },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTypeFilter(t.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  typeFilter === t.value
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}

            {/* Shop filter reset */}
            {shopFilter && (
              <button
                onClick={() => {
                  setShopFilter("");
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition flex items-center gap-1"
              >
                Boutique filtrée <span className="font-bold">&times;</span>
              </button>
            )}
          </div>
        </div>

        {/* Count */}
        <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-50 dark:border-white/[0.03]">
          {total} promo{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Tag size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400">Aucune promo trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {filtered.map((p) => {
              const discounted = Math.round(
                p.priceCents * (1 - (p.promoPct || 0) / 100)
              );
              const typeInfo = p.promoType
                ? PROMO_TYPE_LABELS[p.promoType]
                : null;

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
                >
                  {/* Image */}
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                        <Tag size={18} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {p.name}
                      </span>
                      {/* Promo badge */}
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-red-600 text-white flex-shrink-0">
                        -{p.promoPct}%
                      </span>
                      {typeInfo && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md ${typeInfo.color} flex-shrink-0`}
                        >
                          {typeInfo.label}
                        </span>
                      )}
                      {!p.inStock && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 flex-shrink-0">
                          Rupture
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Link
                        href={`/webmaster/boutiques`}
                        className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition truncate"
                      >
                        {p.shop.name}
                      </Link>
                      {p.category && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">
                            &middot;
                          </span>
                          <span className="text-xs text-gray-400 truncate">
                            {p.category.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400 line-through">
                      {formatPrice(p.priceCents)}
                    </div>
                    <div className="text-sm font-bold text-red-600 dark:text-red-400">
                      {formatPrice(discounted)}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="text-right flex-shrink-0 hidden md:block">
                    {p.promoEnd ? (
                      <span
                        className={`text-xs font-medium ${
                          new Date(p.promoEnd).getTime() - Date.now() <
                          48 * 3_600_000
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-400"
                        }`}
                      >
                        <Clock size={12} className="inline mr-1" />
                        {timeUntil(p.promoEnd)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">
                        Permanente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/[0.06]">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
            >
              <ChevronLeft size={14} /> Préc.
            </button>
            <span className="text-xs text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition"
            >
              Suiv. <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
