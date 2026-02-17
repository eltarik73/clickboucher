"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User, Shield, Loader2 } from "lucide-react";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  shop: { id: string; name: string };
  messages: Message[];
};

export default function TicketChatPage({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [waitingAI, setWaitingAI] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const json = await res.json();
      setTicket(json.data || json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ticketId]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  // Poll for AI response when waiting
  useEffect(() => {
    if (!waitingAI) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const json = await res.json();
      const data = json.data || json;
      if (data?.messages?.length > (ticket?.messages?.length || 0)) {
        setTicket(data);
        setWaitingAI(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [waitingAI, ticketId, ticket?.messages?.length]);

  async function sendMessage() {
    if (!message.trim() || sending) return;
    setSending(true);

    try {
      await fetch(`/api/support/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });

      // Optimistically add the user message
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { id: Date.now().toString(), role: "user", content: message, createdAt: new Date().toISOString() },
              ],
            }
          : prev
      );

      setMessage("");
      setWaitingAI(true);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
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

  const roleConfig: Record<string, { name: string; icon: typeof Bot; bg: string; msgBg: string }> = {
    user: {
      name: "Vous",
      icon: User,
      bg: "bg-blue-600",
      msgBg: "bg-blue-50 dark:bg-blue-500/10",
    },
    ai: {
      name: "Assistant IA",
      icon: Bot,
      bg: "bg-purple-600",
      msgBg: "bg-purple-50 dark:bg-purple-500/10",
    },
    admin: {
      name: "Support Klik&Go",
      icon: Shield,
      bg: "bg-[#DC2626]",
      msgBg: "bg-red-50 dark:bg-red-500/10",
    },
  };

  const isOpen = ticket.status === "OPEN" || ticket.status === "AI_HANDLED" || ticket.status === "ESCALATED";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <Link
          href="/boucher/support"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Retour
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">
          {ticket.subject}
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {ticket.shop.name} &middot;{" "}
          {ticket.status === "ESCALATED"
            ? "Un admin va vous répondre"
            : ticket.status === "RESOLVED"
              ? "Résolu"
              : "IA active"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 space-y-4">
        {ticket.messages.map((msg) => {
          const cfg = roleConfig[msg.role] || roleConfig.user;
          const RoleIcon = cfg.icon;
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center`}>
                <RoleIcon size={14} className="text-white" />
              </div>
              <div className={`max-w-[75%]`}>
                <div className={`flex items-center gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {cfg.name}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-[#f8f6f3] ${cfg.msgBg}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI typing indicator */}
        {waitingAI && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-purple-50 dark:bg-purple-500/10">
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                <Loader2 size={14} className="animate-spin" />
                L&apos;IA rédige sa réponse...
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {isOpen && (
        <div className="shrink-0 pt-4">
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre message..."
              className="flex-1 px-4 py-3 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="px-4 py-3 bg-[#DC2626] text-white rounded-xl hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="shrink-0 pt-4 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Ce ticket est {ticket.status === "RESOLVED" ? "résolu" : "fermé"}
          </p>
        </div>
      )}
    </div>
  );
}
