"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  DollarSign,
  Clock,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────
type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  priceCents: number;
  totalCents: number;
  available: boolean;
  replacement: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  isPro: boolean;
  createdAt: string;
  updatedAt: string;
  estimatedReady: string | null;
  actualReady: string | null;
  pickedUpAt: string | null;
  customerNote: string | null;
  boucherNote: string | null;
  denyReason: string | null;
  qrCode: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  shop: { id: string; name: string; slug: string };
  items: OrderItem[];
};

type StatusTab = "all" | "PENDING" | "active" | "done" | "denied";

// ── Helpers ──────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  ACCEPTED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PREPARING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  PICKED_UP: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  DENIED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
  PARTIALLY_DENIED: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  PREPARING: "En préparation",
  READY: "Prête",
  PICKED_UP: "Récupérée",
  COMPLETED: "Terminée",
  DENIED: "Refusée",
  CANCELLED: "Annulée",
  PARTIALLY_DENIED: "Partielle",
};

function statusBadge(status: string) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(d: string) {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

function processingTime(order: Order): string | null {
  if (!["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"].includes(order.status))
    return null;
  const created = new Date(order.createdAt).getTime();
  const updated = new Date(order.updatedAt).getTime();
  const diff = Math.round((updated - created) / 60000);
  if (diff < 1) return "< 1 min";
  return `${diff} min`;
}

// ── Page Component ───────────────────────────────
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [revenue, setRevenue] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [shopFilter, setShopFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Shops list for filter
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);

  // Detail dialog
  const [detail, setDetail] = useState<Order | null>(null);

  // Load shops for filter dropdown
  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        const list = json.data || json;
        if (Array.isArray(list)) {
          setShops(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        }
      })
      .catch(() => {});
  }, []);

  // Build query and load orders
  const loadOrders = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", p.toString());
        params.set("limit", "20");

        if (statusTab === "PENDING") params.set("status", "PENDING");
        else if (statusTab === "active") {
          // We'll filter client-side for active statuses
        } else if (statusTab === "done") {
          // Client-side filter
        } else if (statusTab === "denied") params.set("status", "DENIED");

        if (shopFilter) params.set("shopId", shopFilter);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        if (search) params.set("search", search);

        const res = await fetch(`/api/admin/orders?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const data = json.data || json;
        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setRevenue(data.revenue);
        setPage(p);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [statusTab, shopFilter, dateFrom, dateTo, search]
  );

  useEffect(() => {
    loadOrders(1);
  }, [loadOrders]);

  // Client-side filter for "active" and "done" tabs (since API only supports single status)
  const filtered = useMemo(() => {
    if (statusTab === "active")
      return orders.filter((o) =>
        ["ACCEPTED", "PREPARING", "READY"].includes(o.status)
      );
    if (statusTab === "done")
      return orders.filter((o) =>
        ["PICKED_UP", "COMPLETED"].includes(o.status)
      );
    return orders;
  }, [orders, statusTab]);

  // Stats
  const filteredRevenue = useMemo(
    () => filtered.reduce((s, o) => s + o.totalCents, 0),
    [filtered]
  );
  const avgProcessing = useMemo(() => {
    const times = filtered
      .filter((o) =>
        ["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"].includes(
          o.status
        )
      )
      .map((o) => {
        const created = new Date(o.createdAt).getTime();
        const updated = new Date(o.updatedAt).getTime();
        return Math.round((updated - created) / 60000);
      })
      .filter((t) => t > 0 && t < 1440);
    if (times.length === 0) return null;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }, [filtered]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const TABS: { key: StatusTab; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "PENDING", label: "En attente" },
    { key: "active", label: "En cours" },
    { key: "done", label: "Terminées" },
    { key: "denied", label: "Refusées" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Commandes
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Suivi de toutes les commandes de la plateforme
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <Package size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Commandes
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {total}
          </p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <DollarSign
                size={14}
                className="text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Revenus
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {fmt(statusTab === "all" ? revenue : filteredRevenue)} €
          </p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10">
              <Clock
                size={14}
                className="text-violet-600 dark:text-violet-400"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Traitement moy.
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {avgProcessing !== null ? `${avgProcessing} min` : "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#141414] rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              statusTab === tab.key
                ? "bg-white dark:bg-white/10 text-gray-900 dark:text-[#f8f6f3] shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="N° commande, nom client, email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/30 text-gray-900 dark:text-[#f8f6f3] placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
            >
              <option value="">Toutes les boucheries</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
            title="Date début"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#DC2626]/30"
            title="Date fin"
          />
          {(shopFilter || dateFrom || dateTo || search) && (
            <button
              onClick={() => {
                setShopFilter("");
                setDateFrom("");
                setDateTo("");
                setSearchInput("");
                setSearch("");
              }}
              className="px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <X size={14} /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* Table / loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500">
            Aucune commande trouvée.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/10">
                    <th className="px-5 py-3 font-medium">Commande</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Boucherie</th>
                    <th className="px-4 py-3 font-medium text-right">Articles</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Traitement</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setDetail(order)}
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-gray-900 dark:text-[#f8f6f3]">
                          #{order.orderNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-700 dark:text-gray-300 text-xs">
                            {order.user.firstName} {order.user.lastName}
                          </span>
                          {order.isPro && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 rounded">
                              PRO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {order.shop.name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {order.items.length}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-[#f8f6f3]">
                        {fmt(order.totalCents)} €
                      </td>
                      <td className="px-4 py-3">{statusBadge(order.status)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(order.createdAt)}
                        <br />
                        <span className="text-gray-400 dark:text-gray-500">
                          {fmtTime(order.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                        {processingTime(order) || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(order);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((order) => (
              <button
                key={order.id}
                onClick={() => setDetail(order)}
                className="w-full text-left bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold text-gray-900 dark:text-[#f8f6f3]">
                    #{order.orderNumber}
                  </span>
                  {statusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>
                    {order.user.firstName} {order.user.lastName}
                    {order.isPro && (
                      <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 rounded">
                        PRO
                      </span>
                    )}
                  </span>
                  <span>{order.shop.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
                    {fmt(order.totalCents)} €
                  </span>
                  <span className="text-xs text-gray-400">
                    {fmtDateTime(order.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Page {page} / {totalPages} ({total} résultats)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => loadOrders(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => loadOrders(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Detail Dialog ───────────────────────── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Commande #{detail?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.user.firstName} ${detail.user.lastName} — ${detail.shop.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Status + meta */}
              <div className="flex items-center gap-3 flex-wrap">
                {statusBadge(detail.status)}
                {detail.isPro && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 rounded-full">
                    PRO
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                  {fmtDateTime(detail.createdAt)}
                </span>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timeline
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      Créée le {fmtDateTime(detail.createdAt)}
                    </span>
                  </div>
                  {detail.estimatedReady && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">
                        Prête estimée : {fmtDateTime(detail.estimatedReady)}
                      </span>
                    </div>
                  )}
                  {detail.actualReady && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">
                        Prête le {fmtDateTime(detail.actualReady)}
                      </span>
                    </div>
                  )}
                  {detail.pickedUpAt && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">
                        Récupérée le {fmtDateTime(detail.pickedUpAt)}
                      </span>
                    </div>
                  )}
                  {detail.denyReason && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-red-600 dark:text-red-400">
                        Refusée : {detail.denyReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Articles ({detail.items.length})
                </h3>
                <div className="divide-y divide-gray-100 dark:divide-white/10 border border-gray-100 dark:border-white/10 rounded-lg overflow-hidden">
                  {detail.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-3 py-2 text-xs ${!item.available ? "bg-red-50/50 dark:bg-red-500/5" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span
                          className={`font-medium ${!item.available ? "line-through text-gray-400" : "text-gray-900 dark:text-[#f8f6f3]"}`}
                        >
                          {item.name}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 ml-1.5">
                          x{item.quantity}{" "}
                          {item.unit === "KG"
                            ? "kg"
                            : item.unit === "PIECE"
                              ? "pc"
                              : "barq."}
                        </span>
                        {item.replacement && (
                          <span className="text-orange-500 dark:text-orange-400 ml-1.5">
                            → {item.replacement}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                        {fmt(item.totalCents)} €
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Total
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                    {fmt(detail.totalCents)} €
                  </span>
                </div>
              </div>

              {/* Notes */}
              {(detail.customerNote || detail.boucherNote) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notes
                  </h3>
                  {detail.customerNote && (
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">
                        Client :
                      </span>{" "}
                      {detail.customerNote}
                    </div>
                  )}
                  {detail.boucherNote && (
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">
                        Boucher :
                      </span>{" "}
                      {detail.boucherNote}
                    </div>
                  )}
                </div>
              )}

              {/* QR Code */}
              {detail.qrCode && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                    QR Code
                  </p>
                  <p className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 break-all">
                    {detail.qrCode}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
