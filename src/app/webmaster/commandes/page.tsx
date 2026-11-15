"use client";

import { useState, useEffect, useCallback } from "react";
import type { OrderStatus } from "@prisma/client";
import {
  Loader2,
  ClipboardList,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Package,
  User,
  Store,
  Calendar,
} from "lucide-react";

// ── Types ──

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

type OrderAdmin = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
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

// ── Helpers ──

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "A l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function unitLabel(u: string) {
  return u === "KG" ? "kg" : u === "PIECE" ? "pce" : u === "TRANCHE" ? "tr." : "barq.";
}

import {
  ORDER_STATUS_COLORS as STATUS_COLORS,
  ORDER_STATUS_LABELS as STATUS_LABELS,
} from "@/lib/design-tokens";

// ── Component ──

export default function WebmasterCommandesPage() {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Shops for filter dropdown
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setShops(
            json.data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (shopFilter) params.set("shopId", shopFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        setOrders(d.orders || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 0);
        setRevenue(d.revenue || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, status, shopFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, status, shopFilter, dateFrom, dateTo]);

  // Count active statuses
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-gray-900 dark:text-white">
            <ClipboardList size={20} /> Commandes
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {total} commande{total > 1 ? "s" : ""}
            {pendingCount > 0 && ` · ${pendingCount} en attente`}
          </p>
        </div>
        {/* Revenue badge */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
          <TrendingUp size={16} className="text-[#DC2626]" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">CA filtre</p>
            <p className="text-sm font-extrabold text-[#DC2626]">{fmtPrice(revenue)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          />
          <input
            type="text"
            placeholder="N° commande, client, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400 dark:text-white"
          />
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Shop */}
        <select
          value={shopFilter}
          onChange={(e) => setShopFilter(e.target.value)}
          className="max-w-[180px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
        >
          <option value="">Toutes boutiques</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Date from */}
        <div className="flex items-center gap-1">
          <Calendar size={12} className="text-gray-500 dark:text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
          />
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#DC2626]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-white/[0.06] dark:bg-[#141414]">
          <ClipboardList size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune commande trouvee</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order, i) => {
            const expanded = expandedId === order.id;
            const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);

            return (
              <div
                key={order.id}
                className="animate-fade-up overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#141414]"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                >
                  {/* Order number + status */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${STATUS_COLORS[order.status] || ""}`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                      {order.isPro && (
                        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {order.user.firstName} {order.user.lastName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Store size={10} />
                        {order.shop.name}
                      </span>
                    </div>
                  </div>

                  {/* Items + Price + Time */}
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="hidden items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 md:flex">
                      <Package size={10} />
                      {order.items.length} art. ({itemCount})
                    </div>
                    <span className="min-w-[70px] text-right text-sm font-bold text-gray-900 dark:text-white">
                      {fmtPrice(order.totalCents)}
                    </span>
                    <span className="min-w-[40px] text-right text-[10px] text-gray-500 dark:text-gray-400">
                      {relTime(order.createdAt)}
                    </span>
                    {expanded ? (
                      <ChevronUp size={14} className="text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-white/5">
                    {/* Order meta */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">Créé le</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {fmtDate(order.createdAt)}
                        </span>
                      </div>
                      {order.estimatedReady && (
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">
                            Estimé prêt
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {fmtDate(order.estimatedReady)}
                          </span>
                        </div>
                      )}
                      {order.actualReady && (
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Pret a</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {fmtDate(order.actualReady)}
                          </span>
                        </div>
                      )}
                      {order.pickedUpAt && (
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Retire a</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {fmtDate(order.pickedUpAt)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">Client</span>
                        <span className="text-gray-700 dark:text-gray-300">{order.user.email}</span>
                      </div>
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">Boutique</span>
                        <span className="text-gray-700 dark:text-gray-300">{order.shop.name}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {order.customerNote && (
                      <div className="rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          Note client:
                        </span>
                        <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                          {order.customerNote}
                        </p>
                      </div>
                    )}
                    {order.boucherNote && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          Note boucher:
                        </span>
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                          {order.boucherNote}
                        </p>
                      </div>
                    )}
                    {order.denyReason && (
                      <div className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-500/10">
                        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                          Raison refus:
                        </span>
                        <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                          {order.denyReason}
                        </p>
                      </div>
                    )}

                    {/* Items table */}
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Articles
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0 dark:border-white/[0.03] ${
                              !item.available ? "line-through opacity-40" : ""
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="w-[50px] text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                {item.quantity} {unitLabel(item.unit)}
                              </span>
                              <span className="truncate text-xs font-medium text-gray-900 dark:text-white">
                                {item.name}
                              </span>
                              {item.replacement && (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600">
                                  → {item.replacement}
                                </span>
                              )}
                            </div>
                            <span className="ml-2 shrink-0 text-xs font-semibold text-gray-700 dark:text-gray-300">
                              {fmtPrice(item.totalCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Total */}
                      <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-white/10">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          Total
                        </span>
                        <span className="text-sm font-extrabold text-[#DC2626]">
                          {fmtPrice(order.totalCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages} ({total} resultats)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white transition-all hover:bg-gray-50 disabled:opacity-30 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
            >
              <ChevronLeft size={14} />
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                    p === page
                      ? "bg-[#DC2626] text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white transition-all hover:bg-gray-50 disabled:opacity-30 dark:border-white/10 dark:bg-[#141414] dark:hover:bg-white/5"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
