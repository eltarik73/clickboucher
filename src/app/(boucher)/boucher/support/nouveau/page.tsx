"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

type Shop = {
  id: string;
  name: string;
};

export default function NewTicketPage() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [shopId, setShopId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shops/my-shop")
      .then(async (r) => {
        const json = await r.json();
        const data = json.data || json;
        if (Array.isArray(data)) {
          setShops(data);
          if (data.length === 1) setShopId(data[0].id);
        } else if (data?.id) {
          setShops([data]);
          setShopId(data.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId || !subject.trim() || !message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, subject, message }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Erreur");

      const ticketId = json.data?.id;
      router.push(`/boucher/support/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setSending(false);
    }
  }

  const QUICK_SUBJECTS = [
    "Problème de commande",
    "Question sur mon abonnement",
    "Bug technique",
    "Problème de paiement",
    "Modification de mes informations",
    "Autre question",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[3px] border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/boucher/support"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition-colors"
      >
        <ArrowLeft size={16} />
        Retour au support
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8f6f3]">
          Nouveau ticket
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Décrivez votre problème, notre IA vous répondra instantanément
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Quick subject buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Sujet
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {QUICK_SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  subject === s
                    ? "bg-[#DC2626] text-white"
                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ou saisissez votre sujet..."
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Votre message
          </label>
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre problème en détail..."
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-[#f8f6f3] outline-none focus:ring-2 focus:ring-[#DC2626]/30 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !subject.trim() || !message.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send size={16} />
                Envoyer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
