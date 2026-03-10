"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Store,
  Bot,
  ShieldCheck,
  User,
  Clock,
  AlertTriangle,
} from "lucide-react";

/* ─── types ─── */
interface Message {
  id: string;
  ticketId: string;
  role: string; // "user" | "ai" | "admin"
  content: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  userId: string;
  shopId: string;
  shop: { id: string; name: string; phone: string | null };
  escalatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messages: Message[];
}

/* ─── status config ─── */
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Ouvert", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  AI_HANDLED: { label: "IA", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400" },
  ESCALATED: { label: "Escaladé", color: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400" },
  RESOLVED: { label: "Résolu", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  CLOSED: { label: "Fermé", color: "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400" },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof User }> = {
  user: {
    label: "Boucher",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
    icon: User,
  },
  ai: {
    label: "Assistant IA",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
    icon: Bot,
  },
  admin: {
    label: "Support Klik&Go",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
    icon: ShieldCheck,
  },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ================================================================== */
export default function WebmasterTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`);
      const d = await res.json();
      if (d.success) setTicket(d.data);
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const isOpen = ticket && ["OPEN", "AI_HANDLED", "ESCALATED"].includes(ticket.status);

  /* ── Send reply ── */
  const sendReply = async (closeTicket: boolean) => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim(), closeTicket }),
      });
      if (res.ok) {
        setReply("");
        fetchTicket();
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setSending(false);
    }
  };

  /* ── Update status ── */
  const updateStatus = async (status: string) => {
    setUpdatingStatus(status);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchTicket();
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-gray-500 dark:text-gray-400">Ticket introuvable.</p>
        <Link href="/webmaster/support" className="text-sm text-red-600 hover:underline">
          Retour au support
        </Link>
      </div>
    );
  }

  const stCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/webmaster/support"
          className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition mt-0.5"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-lg font-bold text-gray-900 dark:text-white">
              {ticket.subject}
            </h1>
            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${stCfg.color}`}>
              {stCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <Store size={12} />
            <span>{ticket.shop.name}</span>
            <span>·</span>
            <Clock size={12} />
            <span>{formatDate(ticket.createdAt)}</span>
            {ticket.shop.phone && (
              <>
                <span>·</span>
                <span>{ticket.shop.phone}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Escalated warning */}
      {ticket.status === "ESCALATED" && (
        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <span className="text-sm text-orange-700 dark:text-orange-400">
            Ce ticket a été escaladé par l&apos;IA — réponse humaine requise.
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {isOpen && (
          <>
            <button
              onClick={() => updateStatus("RESOLVED")}
              disabled={updatingStatus !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {updatingStatus === "RESOLVED" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              Résoudre
            </button>
            <button
              onClick={() => updateStatus("CLOSED")}
              disabled={updatingStatus !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {updatingStatus === "CLOSED" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <XCircle size={12} />
              )}
              Fermer
            </button>
          </>
        )}
        {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
          <button
            onClick={() => updateStatus("OPEN")}
            disabled={updatingStatus !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {updatingStatus === "OPEN" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Clock size={12} />
            )}
            Rouvrir
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
          {ticket.messages.map((msg) => {
            const roleCfg = ROLE_CONFIG[msg.role] || ROLE_CONFIG.user;
            const RoleIcon = roleCfg.icon;
            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-3 ${roleCfg.bg}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <RoleIcon size={14} className={roleCfg.color} />
                  <span className={`text-xs font-semibold ${roleCfg.color}`}>
                    {roleCfg.label}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {isOpen && (
          <div className="border-t border-gray-100 dark:border-white/[0.06] p-3">
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Répondre au boucher..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendReply(false);
                  }
                }}
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => sendReply(false)}
                  disabled={!reply.trim() || sending}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                  title="Envoyer"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
                <button
                  onClick={() => sendReply(true)}
                  disabled={!reply.trim() || sending}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  title="Envoyer + résoudre"
                >
                  <CheckCircle size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              Ctrl+Entrée pour envoyer · Bouton vert = envoyer + résoudre
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
