"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings,
  Save,
  Loader2,
  Check,
  Calendar,
  Plus,
  Trash2,
  Coins,
  Sliders,
  Database,
  AlertTriangle,
  X,
} from "lucide-react";

/* ─── types ─── */
interface ConfigItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  description: string | null;
  date: string;
  type: string;
  emoji: string | null;
  alertDaysBefore: number;
  active: boolean;
}

/* ─── config labels ─── */
const CONFIG_META: Record<
  string,
  { label: string; description: string; type: "text" | "number" | "email" }
> = {
  platform_name: {
    label: "Nom de la plateforme",
    description: "Nom affiché dans les emails, tickets, etc.",
    type: "text",
  },
  default_commission_pct: {
    label: "Commission par défaut (%)",
    description: "Taux appliqué aux nouvelles boutiques",
    type: "number",
  },
  trial_days: {
    label: "Durée essai gratuit (jours)",
    description: "Période d'essai pour les nouveaux abonnements",
    type: "number",
  },
  max_order_value_cents: {
    label: "Montant max commande (centimes)",
    description: "Valeur maximale acceptée par commande",
    type: "number",
  },
  support_email: {
    label: "Email support",
    description: "Adresse de contact support affichée aux clients",
    type: "email",
  },
};

const EVENT_TYPES = [
  { value: "fermeture", label: "Fermeture", emoji: "🔒" },
  { value: "promo", label: "Promo", emoji: "🏷️" },
  { value: "evenement", label: "Événement", emoji: "📅" },
  { value: "fete", label: "Fête", emoji: "🎉" },
];

/* ================================================================== */
export default function WebmasterParametresPage() {
  /* ── Config state ── */
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  /* ── Global commission state ── */
  const [globalPct, setGlobalPct] = useState("5");
  const [applyingCommission, setApplyingCommission] = useState(false);
  const [commissionApplied, setCommissionApplied] = useState(false);

  /* ── Calendar state ── */
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: "",
    type: "evenement",
    emoji: "📅",
    alertDaysBefore: 7,
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);

  /* ── Fetch config ── */
  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const res = await fetch("/api/webmaster/config");
      const d = await res.json();
      if (d.success) {
        setConfigs(d.data);
        const vals: Record<string, string> = {};
        for (const c of d.data) vals[c.key] = c.value;
        setEditValues(vals);
        if (vals.default_commission_pct) setGlobalPct(vals.default_commission_pct);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  /* ── Fetch calendar events ── */
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/admin/calendar");
      const d = await res.json();
      if (d.success) setEvents(d.data);
    } catch {
      /* ignore */
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchEvents();
  }, [fetchConfigs, fetchEvents]);

  /* ── Save config value ── */
  const saveConfig = async (key: string) => {
    const val = editValues[key];
    if (val === undefined) return;
    setSavingKey(key);
    try {
      const res = await fetch("/api/webmaster/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: val }),
      });
      if (res.ok) {
        setSavedKey(key);
        setTimeout(() => setSavedKey(null), 2000);
      }
    } catch {
      /* ignore */
    } finally {
      setSavingKey(null);
    }
  };

  /* ── Apply global commission ── */
  const applyGlobalCommission = async () => {
    setApplyingCommission(true);
    try {
      const res = await fetch("/api/admin/commission/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionPct: Number(globalPct),
          commissionEnabled: true,
        }),
      });
      if (res.ok) {
        // Also save to platform config
        await fetch("/api/webmaster/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "default_commission_pct", value: globalPct }),
        });
        setCommissionApplied(true);
        setTimeout(() => setCommissionApplied(false), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setApplyingCommission(false);
    }
  };

  /* ── Create calendar event ── */
  const createEvent = async () => {
    if (!newEvent.name || !newEvent.date) return;
    setCreatingEvent(true);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newEvent,
          date: new Date(newEvent.date).toISOString(),
          description: newEvent.description || undefined,
        }),
      });
      if (res.ok) {
        setNewEvent({ name: "", description: "", date: "", type: "evenement", emoji: "📅", alertDaysBefore: 7 });
        setShowNewEvent(false);
        fetchEvents();
      }
    } catch {
      /* ignore */
    } finally {
      setCreatingEvent(false);
    }
  };

  /* ── Delete calendar event ── */
  const deleteEvent = async (id: string) => {
    setDeletingEvent(id);
    try {
      await fetch(`/api/admin/calendar/${id}`, { method: "DELETE" });
      setEvents((evts) => evts.filter((e) => e.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeletingEvent(null);
    }
  };

  /* ── Toggle calendar event active ── */
  const toggleEventActive = async (evt: CalendarEvent) => {
    setEvents((evts) => evts.map((e) => (e.id === evt.id ? { ...e, active: !e.active } : e)));
    try {
      await fetch(`/api/admin/calendar/${evt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !evt.active }),
      });
    } catch {
      setEvents((evts) => evts.map((e) => (e.id === evt.id ? { ...e, active: evt.active } : e)));
    }
  };

  const configKeys = Object.keys(CONFIG_META);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings size={20} /> Paramètres
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Configuration globale de la plateforme
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 1: Platform Config */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Database} title="Configuration plateforme">
        {loadingConfigs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {configKeys.map((key) => {
              const meta = CONFIG_META[key];
              const current = editValues[key] ?? "";
              const original = configs.find((c) => c.key === key)?.value ?? "";
              const changed = current !== original;

              return (
                <div key={key} className="flex flex-col md:flex-row md:items-end gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {meta.label}
                    </label>
                    <p className="text-xs text-gray-400 mb-1">{meta.description}</p>
                    <input
                      type={meta.type}
                      value={current}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <button
                    onClick={() => saveConfig(key)}
                    disabled={!changed || savingKey === key}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium transition ${
                      savedKey === key
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : changed
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {savingKey === key ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : savedKey === key ? (
                      <Check size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {savedKey === key ? "Sauvé" : "Sauver"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 2: Global Commission */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Coins} title="Commission globale">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Appliquer un taux de commission identique à toutes les boutiques actives.
        </p>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Taux (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={globalPct}
                onChange={(e) => setGlobalPct(e.target.value)}
                className="flex-1 accent-red-600"
              />
              <span className="text-lg font-bold text-gray-900 dark:text-white w-14 text-right">
                {globalPct}%
              </span>
            </div>
          </div>
          <button
            onClick={applyGlobalCommission}
            disabled={applyingCommission}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium transition ${
              commissionApplied
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {applyingCommission ? (
              <Loader2 size={14} className="animate-spin" />
            ) : commissionApplied ? (
              <Check size={14} />
            ) : (
              <Sliders size={14} />
            )}
            {commissionApplied ? "Appliqué à toutes les boutiques" : "Appliquer à toutes les boutiques"}
          </button>
        </div>
        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Cette action modifie le taux de commission de <strong>toutes</strong> les boutiques. Les taux individuels déjà configurés seront écrasés.
          </p>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 3: Calendar Events */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Calendar} title="Événements calendrier">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Événements de la plateforme (fêtes religieuses, promotions, fermetures). Les alertes sont envoyées aux bouchers X jours avant.
        </p>

        {/* Event list */}
        {loadingEvents ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucun événement configuré.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {events.map((evt) => (
              <div
                key={evt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  evt.active
                    ? "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06]"
                    : "bg-gray-50/50 dark:bg-white/[0.01] border-gray-100 dark:border-white/[0.03] opacity-50"
                }`}
              >
                <span className="text-lg">{evt.emoji || "📅"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {evt.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(evt.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    <span className="capitalize">{evt.type}</span>
                    {" · Alerte J-"}
                    {evt.alertDaysBefore}
                  </div>
                </div>

                {/* Toggle active */}
                <button
                  onClick={() => toggleEventActive(evt)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition ${
                    evt.active
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {evt.active ? "Actif" : "Inactif"}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteEvent(evt.id)}
                  disabled={deletingEvent === evt.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                >
                  {deletingEvent === evt.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New event form */}
        {showNewEvent ? (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Nouvel événement
              </h3>
              <button
                onClick={() => setShowNewEvent(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Nom
                </label>
                <input
                  type="text"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent((v) => ({ ...v, name: e.target.value }))}
                  placeholder="Ex: Aïd el-Fitr"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent((v) => ({ ...v, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Type
                </label>
                <select
                  value={newEvent.type}
                  onChange={(e) => {
                    const t = EVENT_TYPES.find((et) => et.value === e.target.value);
                    setNewEvent((v) => ({
                      ...v,
                      type: e.target.value,
                      emoji: t?.emoji || "📅",
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Alerte (jours avant)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={newEvent.alertDaysBefore}
                  onChange={(e) =>
                    setNewEvent((v) => ({ ...v, alertDaysBefore: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Description (optionnel)
              </label>
              <input
                type="text"
                value={newEvent.description}
                onChange={(e) => setNewEvent((v) => ({ ...v, description: e.target.value }))}
                placeholder="Description courte"
                className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={createEvent}
                disabled={!newEvent.name || !newEvent.date || creatingEvent}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {creatingEvent ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Créer
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewEvent(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition"
          >
            <Plus size={14} /> Ajouter un événement
          </button>
        )}
      </Section>
    </div>
  );
}

/* ================================================================== */
/* ── Section wrapper ─── */
/* ================================================================== */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Settings;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm p-4 md:p-5">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Icon size={16} /> {title}
      </h2>
      {children}
    </div>
  );
}
