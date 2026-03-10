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
  Search,
  ChevronDown,
  HelpCircle,
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

type FAQ = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

const FAQ_CATEGORIES = [
  { key: "", label: "Tout" },
  { key: "boutique", label: "Boutique" },
  { key: "commandes", label: "Commandes" },
  { key: "facturation", label: "Facturation" },
  { key: "technique", label: "Technique" },
  { key: "compte", label: "Compte" },
];

export default function BoucherSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCat, setFaqCat] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/support/tickets")
      .then(async (r) => {
        const json = await r.json();
        setTickets(json.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch FAQ
  useEffect(() => {
    const params = new URLSearchParams();
    if (faqSearch.trim()) params.set("q", faqSearch.trim());
    if (faqCat) params.set("category", faqCat);
    fetch(`/api/support/faq?${params}`)
      .then(async (r) => {
        const json = await r.json();
        setFaqs(json.data || []);
      })
      .catch(() => {});
  }, [faqSearch, faqCat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
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

      {/* ── FAQ Section ── */}
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-white/5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3] flex items-center gap-2">
            <HelpCircle size={16} className="text-[#DC2626]" />
            Questions fréquentes
          </h2>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-[#DC2626] text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setFaqCat(cat.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    faqCat === cat.key
                      ? "bg-[#DC2626] text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {faqs.length > 0 ? (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {faqs.slice(0, 8).map((faq) => (
              <button
                key={faq.id}
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                className="w-full text-left px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#f8f6f3]">
                    {faq.question}
                  </p>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 dark:text-gray-500 shrink-0 transition-transform ${expandedFaq === faq.id ? "rotate-180" : ""}`}
                  />
                </div>
                {expandedFaq === faq.id && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            Aucun résultat pour cette recherche
          </div>
        )}
      </div>

      {/* ── Tickets Section ── */}
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
