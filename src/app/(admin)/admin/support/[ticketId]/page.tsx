"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle, XCircle } from "lucide-react";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  userId: string;
  createdAt: string;
  shop: { id: string; name: string; phone: string };
  messages: Message[];
};

export default function AdminTicketDetailPage({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`);
      const json = await res.json();
      setTicket(json.data || json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ticketId]);

  async function sendReply(closeTicket = false) {
    if (!reply.trim()) return;
    setSending(true);
    await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply, closeTicket }),
    });
    setReply("");
    await load();
    setSending(false);
  }

  async function updateStatus(status: string) {
    await fetch(`/api/admin/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-500">Ticket introuvable</p>
      </div>
    );
  }

  const roleLabel: Record<string, { name: string; bg: string }> = {
    user: { name: "Boucher", bg: "bg-blue-600" },
    ai: { name: "IA", bg: "bg-purple-600" },
    admin: { name: "Admin", bg: "bg-[#DC2626]" },
  };

  const isOpen = ticket.status === "OPEN" || ticket.status === "ESCALATED" || ticket.status === "AI_HANDLED";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors"
      >
        <ArrowLeft size={16} />
        Retour au support
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#f8f6f3]">
            {ticket.subject}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {ticket.shop.name} &middot; {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex gap-2">
          {isOpen && (
            <button
              onClick={() => updateStatus("RESOLVED")}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle size={14} /> Résoudre
            </button>
          )}
          {isOpen && (
            <button
              onClick={() => updateStatus("CLOSED")}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              <XCircle size={14} /> Fermer
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
        <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
          {ticket.messages.map((msg) => {
            const info = roleLabel[msg.role] || roleLabel.user;
            const isAdmin = msg.role === "admin";
            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] ${isAdmin ? "order-1" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`${info.bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>
                      {info.name}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <div className={`rounded-xl px-4 py-3 text-sm ${
                    isAdmin
                      ? "bg-[#DC2626]/10 text-gray-900 dark:text-[#f8f6f3]"
                      : msg.role === "ai"
                        ? "bg-purple-50 dark:bg-purple-500/10 text-gray-900 dark:text-[#f8f6f3]"
                        : "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-[#f8f6f3]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply input */}
        {isOpen && (
          <div className="border-t border-gray-100 dark:border-white/10 p-4">
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Votre réponse..."
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <button
                onClick={() => sendReply(false)}
                disabled={sending || !reply.trim()}
                className="px-4 py-2.5 bg-[#DC2626] text-white rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
              </button>
              <button
                onClick={() => sendReply(true)}
                disabled={sending || !reply.trim()}
                className="px-4 py-2.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                title="Répondre et résoudre"
              >
                <CheckCircle size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
