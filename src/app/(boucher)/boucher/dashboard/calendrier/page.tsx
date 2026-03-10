// src/app/(boucher)/boucher/dashboard/calendrier/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Bell, Sparkles, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";

// ── Religious calendar events (Hijri dates converted to Gregorian approximations) ──
const RELIGIOUS_EVENTS = [
  {
    id: "ramadan-2025",
    name: "Ramadan",
    description: "Mois sacré du jeûne. Forte demande en viande pour le ftour et le shour.",
    date: "2025-03-01",
    endDate: "2025-03-30",
    type: "ramadan",
    emoji: "🌙",
    alertDaysBefore: 14,
    suggestedProducts: ["Agneau", "Bœuf haché", "Brochettes", "Merguez", "Viande pour tajine"],
  },
  {
    id: "aid-fitr-2025",
    name: "Aïd el-Fitr",
    description: "Fête de la rupture du jeûne. Commandes familiales importantes.",
    date: "2025-03-31",
    type: "aid",
    emoji: "🎉",
    alertDaysBefore: 7,
    suggestedProducts: ["Gigot d'agneau", "Épaule d'agneau", "Méchoui", "Brochettes", "Kefta"],
  },
  {
    id: "aid-adha-2025",
    name: "Aïd el-Adha",
    description: "Fête du sacrifice. Pic de demande en mouton entier et pièces d'agneau.",
    date: "2025-06-07",
    type: "aid",
    emoji: "🐑",
    alertDaysBefore: 21,
    suggestedProducts: ["Mouton entier", "Demi-mouton", "Gigot", "Épaule", "Côtelettes d'agneau"],
  },
  {
    id: "mawlid-2025",
    name: "Mawlid (Naissance du Prophète)",
    description: "Célébration de la naissance du Prophète. Demande modérée en viandes festives.",
    date: "2025-09-05",
    type: "mawlid",
    emoji: "✨",
    alertDaysBefore: 7,
    suggestedProducts: ["Gigot", "Brochettes", "Viande hachée"],
  },
  {
    id: "ramadan-2026",
    name: "Ramadan",
    description: "Mois sacré du jeûne. Forte demande en viande pour le ftour et le shour.",
    date: "2026-02-18",
    endDate: "2026-03-19",
    type: "ramadan",
    emoji: "🌙",
    alertDaysBefore: 14,
    suggestedProducts: ["Agneau", "Bœuf haché", "Brochettes", "Merguez", "Viande pour tajine"],
  },
  {
    id: "aid-fitr-2026",
    name: "Aïd el-Fitr",
    description: "Fête de la rupture du jeûne. Commandes familiales importantes.",
    date: "2026-03-20",
    type: "aid",
    emoji: "🎉",
    alertDaysBefore: 7,
    suggestedProducts: ["Gigot d'agneau", "Épaule d'agneau", "Méchoui", "Brochettes", "Kefta"],
  },
  {
    id: "aid-adha-2026",
    name: "Aïd el-Adha",
    description: "Fête du sacrifice. Pic de demande en mouton entier et pièces d'agneau.",
    date: "2026-05-27",
    type: "aid",
    emoji: "🐑",
    alertDaysBefore: 21,
    suggestedProducts: ["Mouton entier", "Demi-mouton", "Gigot", "Épaule", "Côtelettes d'agneau"],
  },
];

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

type CustomEvent = {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  type: string;
  emoji?: string | null;
  shopId?: string | null;
};

const EVENT_TYPES = [
  { value: "fermeture", label: "Fermeture", emoji: "🔒" },
  { value: "promo", label: "Promo spéciale", emoji: "🏷️" },
  { value: "evenement", label: "Événement", emoji: "📅" },
  { value: "fete", label: "Fête / Célébration", emoji: "🎉" },
];

export default function CalendrierPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dbEvents, setDbEvents] = useState<typeof RELIGIOUS_EVENTS>([]);
  const [myEvents, setMyEvents] = useState<CustomEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formType, setFormType] = useState("fermeture");
  const [formDesc, setFormDesc] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    // Load global events
    fetch("/api/calendar-events")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) setDbEvents(json.data);
      })
      .catch(() => {});
    // Load my custom events
    fetch("/api/boucher/calendar")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) setMyEvents(json.data);
      })
      .catch(() => {});
  }, []);

  async function addCustomEvent() {
    if (!formName.trim() || !formDate) return;
    setFormSaving(true);
    try {
      const evtType = EVENT_TYPES.find((t) => t.value === formType);
      const res = await fetch("/api/boucher/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          date: formDate,
          type: formType,
          emoji: evtType?.emoji,
          description: formDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setMyEvents((prev) => [...prev, json.data]);
        setFormName(""); setFormDate(""); setFormDesc("");
        setShowForm(false);
      }
    } catch { /* ignore */ }
    finally { setFormSaving(false); }
  }

  async function deleteCustomEvent(id: string) {
    try {
      const res = await fetch("/api/boucher/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMyEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch { /* ignore */ }
  }

  // Merge events, deduplicating boucher's custom events that appear in both dbEvents and myEvents
  const myEventIds = new Set(myEvents.map((e) => e.id));
  const allEvents = [
    ...RELIGIOUS_EVENTS,
    ...dbEvents.filter((e) => !myEventIds.has(e.id)),
    ...myEvents.map((e) => ({
      ...e,
      emoji: e.emoji || "📅",
      alertDaysBefore: 7,
      suggestedProducts: [] as string[],
      isCustom: true,
    })),
  ];
  const filtered = allEvents
    .filter((e) => new Date(e.date).getFullYear() === year)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcoming = allEvents
    .filter((e) => daysUntil(e.date) > 0 && daysUntil(e.date) <= 30)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/boucher/dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Calendrier</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Anticipez la demande</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Fermer" : "Ajouter"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {/* ── Add event form ── */}
        {showForm && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Nouvel evenement</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nom (ex: Fermeture Aïd)"
                className="col-span-2 w-full h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                maxLength={200}
              />
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] dark:text-white px-3 text-sm"
              />
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] dark:text-white px-3 text-sm"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Description (optionnel)"
              className="w-full h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
              maxLength={500}
            />
            <button
              onClick={addCustomEvent}
              disabled={formSaving || !formName.trim() || !formDate}
              className="w-full h-10 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors"
            >
              {formSaving ? "Enregistrement..." : "Ajouter au calendrier"}
            </button>
          </div>
        )}

        {/* Upcoming alerts */}
        {upcoming.length > 0 && (
          <div className="space-y-3">
            {upcoming.map((event) => {
              const days = daysUntil(event.date);
              return (
                <div
                  key={event.id || event.name + event.date}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        {event.emoji} {event.name} dans {days} jour{days > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {event.description}
                      </p>
                      {event.suggestedProducts && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.suggestedProducts.map((p) => (
                            <span key={p} className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-full">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Year navigator */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setYear((y) => y - 1)} className="p-2 rounded-xl bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10">
            <ChevronLeft size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="p-2 rounded-xl bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10">
            <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Events list */}
        <div className="space-y-3">
          {filtered.map((event) => {
            const days = daysUntil(event.date);
            const isPast = days < 0;

            return (
              <div
                key={event.id || event.name + event.date}
                className={`bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5 ${isPast ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{event.emoji}</div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{event.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(event.date)}
                        {"endDate" in event && event.endDate && ` → ${formatDate(event.endDate as string)}`}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{event.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isPast && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${days <= 7 ? "bg-red-100 text-red-700" : days <= 21 ? "bg-amber-100 text-amber-700" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"}`}>
                        J-{days}
                      </span>
                    )}
                    {"isCustom" in event && event.isCustom && (
                      <button
                        onClick={() => deleteCustomEvent(event.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggested products */}
                {event.suggestedProducts && event.suggestedProducts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#ece8e3] dark:border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                      <Sparkles size={10} /> Produits suggérés
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.suggestedProducts.map((p) => (
                        <span key={p} className="text-xs px-2.5 py-1 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-100 dark:border-white/10">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-12">
              Aucun événement pour {year}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
