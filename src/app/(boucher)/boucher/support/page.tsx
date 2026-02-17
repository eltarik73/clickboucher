"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bot,
} from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  shop: { id: string; name: string };
  _count: { messages: number };
};

const STATUS_MAP: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  OPEN: { label: "Ouvert", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", icon: Clock },
  AI_HANDLED: { label: "IA a répondu", cls: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400", icon: Bot },
  ESCALATED: { label: "En cours", cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", icon: AlertTriangle },
  RESOLVED: { label: "Résolu", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400", icon: CheckCircle },
  CLOSED: { label: "Fermé", cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400", icon: CheckCircle },
};

export default function BoucherSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/support/tickets")
      .then(async (r) => {
        const json = await r.json();
        setTickets(json.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3] flex items-center gap-2">
            <Headphones size={24} className="text-[#DC2626]" />
            Support
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Besoin d&apos;aide ? Notre IA répond instantanément
          </p>
        </div>
        <Link
          href="/boucher/support/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] transition-colors"
        >
          <Plus size={16} />
          Nouveau ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-12 text-center">
          <Headphones size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Aucun ticket de support
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Créez un ticket pour obtenir de l&apos;aide
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {tickets.map((ticket) => {
              const st = STATUS_MAP[ticket.status] || STATUS_MAP.OPEN;
              const StIcon = st.icon;
              return (
                <Link
                  key={ticket.id}
                  href={`/boucher/support/${ticket.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="shrink-0">
                    <MessageSquare size={20} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3] truncate">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(ticket.createdAt).toLocaleDateString("fr-FR")} &middot;{" "}
                      {ticket._count.messages} message(s)
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                    <StIcon size={12} />
                    {st.label}
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
