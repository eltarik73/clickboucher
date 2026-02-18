"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headphones, MessageSquare, Clock, CheckCircle, AlertTriangle } from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  shop: { id: string; name: string };
  _count: { messages: number };
};

const STATUS_BADGES: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  OPEN: { label: "Ouvert", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", Icon: Clock },
  AI_HANDLED: { label: "IA", cls: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400", Icon: MessageSquare },
  ESCALATED: { label: "Escaladé", cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", Icon: AlertTriangle },
  RESOLVED: { label: "Résolu", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400", Icon: CheckCircle },
  CLOSED: { label: "Fermé", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400", Icon: CheckCircle },
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load(status?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ perPage: "50" });
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/support/tickets?${params}`);
      const json = await res.json();
      const data = json.data || json;
      setTickets(data.tickets || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const counts = {
    all: tickets.length,
    OPEN: tickets.filter((t) => t.status === "OPEN").length,
    ESCALATED: tickets.filter((t) => t.status === "ESCALATED").length,
    AI_HANDLED: tickets.filter((t) => t.status === "AI_HANDLED").length,
    RESOLVED: tickets.filter((t) => t.status === "RESOLVED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3] flex items-center gap-2">
          <Headphones size={24} className="text-[#DC2626]" />
          Support
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tickets de support des bouchers
        </p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "Tous" },
          { key: "OPEN", label: "Ouverts" },
          { key: "ESCALATED", label: "Escaladés" },
          { key: "AI_HANDLED", label: "IA" },
          { key: "RESOLVED", label: "Résolus" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === key
                ? "bg-[#DC2626] text-white"
                : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
            }`}
          >
            {label} ({counts[key as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {/* Tickets list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-12 text-center">
          <Headphones size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500">Aucun ticket</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {tickets.map((ticket) => {
              const badge = STATUS_BADGES[ticket.status] || STATUS_BADGES.OPEN;
              const BadgeIcon = badge.Icon;
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3] truncate">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {ticket.shop.name} &middot; {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                      &middot; {ticket._count.messages} message(s)
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                    <BadgeIcon size={12} />
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
