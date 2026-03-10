"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Headphones,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Store,
  AlertTriangle,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

/* ─── types ─── */
interface Ticket {
  id: string;
  subject: string;
  status: string;
  userId: string;
  shopId: string;
  shop: { id: string; name: string };
  escalatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

/* ─── status config ─── */
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  OPEN: {
    label: "Ouvert",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    icon: Clock,
  },
  AI_HANDLED: {
    label: "IA",
    color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
    icon: Bot,
  },
  ESCALATED: {
    label: "Escaladé",
    color: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
  },
  RESOLVED: {
    label: "Résolu",
    color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle,
  },
  CLOSED: {
    label: "Fermé",
    color: "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
};

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "OPEN", label: "Ouverts" },
  { value: "ESCALATED", label: "Escaladés" },
  { value: "AI_HANDLED", label: "IA" },
  { value: "RESOLVED", label: "Résolus" },
  { value: "CLOSED", label: "Fermés" },
];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

/* ================================================================== */
export default function WebmasterSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", "20");
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/support/tickets?${params}`);
      const d = await res.json();
      if (d.success) {
        setTickets(d.data.tickets);
        setTotal(d.data.pagination.total);
        setTotalPages(d.data.pagination.totalPages);
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  /* ── client-side search filter ── */
  const filtered = search
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          t.shop.name.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  /* ── escalated count ── */
  const escalatedCount = tickets.filter((t) => t.status === "ESCALATED").length;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Headphones size={20} /> Support
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tickets de support — {total} ticket{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Escalated alert */}
      {escalatedCount > 0 && !statusFilter && (
        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <span className="text-sm text-orange-700 dark:text-orange-400">
            <strong>{escalatedCount}</strong> ticket{escalatedCount > 1 ? "s" : ""} escaladé{escalatedCount > 1 ? "s" : ""} — réponse humaine requise.
          </span>
        </div>
      )}

      {/* Search + filters */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher sujet, boutique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                statusFilter === sf.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-12 text-center">
          <Headphones size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun ticket trouvé.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => {
            const stCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
            const StatusIcon = stCfg.icon;
            return (
              <Link
                key={ticket.id}
                href={`/webmaster/support/${ticket.id}`}
                className="block bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm hover:shadow-md transition p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${stCfg.color}`}>
                    <StatusIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {ticket.subject}
                      </h3>
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${stCfg.color} flex-shrink-0`}>
                        {stCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Store size={11} /> {ticket.shop.name}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={11} /> {ticket._count.messages}
                      </span>
                      <span>·</span>
                      <span>{timeAgo(ticket.createdAt)}</span>
                    </div>
                  </div>
                  {ticket.status === "ESCALATED" && (
                    <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-orange-500 text-white animate-pulse flex-shrink-0">
                      URGENT
                    </span>
                  )}
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) pageNum = i + 1;
            else if (page <= 4) pageNum = i + 1;
            else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
            else pageNum = page - 3 + i;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-xl text-xs font-medium transition ${
                  page === pageNum
                    ? "bg-red-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
