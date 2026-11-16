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
  Scale,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { refusalMessageOf } from "@/lib/api/client-refusal";
import { MAX_INCREASE_PCT_KEY } from "@/lib/price-adjustment-config";
import { CommercialEmailsToggle } from "@/components/webmaster/CommercialEmailsToggle";

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

  /* ── Price adjustment setting: the safety cap of one adjustment, in % ── */
  const [paCap, setPaCap] = useState("");
  const [paCapOriginal, setPaCapOriginal] = useState("");
  const [paSaving, setPaSaving] = useState(false);
  const [loadingPaConfig, setLoadingPaConfig] = useState(true);

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
      } else {
        toast.error(refusalMessageOf(d) ?? "Impossible de charger la configuration");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  /* ── Fetch price adjustment setting ── */
  const fetchPaConfig = useCallback(async () => {
    setLoadingPaConfig(true);
    try {
      const res = await fetch("/api/webmaster/config/price-adjustment");
      const d = await res.json();
      if (d.success) {
        const cap = String(d.data.maxIncreasePct);
        setPaCap(cap);
        setPaCapOriginal(cap);
      } else {
        toast.error(refusalMessageOf(d) ?? "Impossible de charger le plafond d'ajustement");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoadingPaConfig(false);
    }
  }, []);

  /* ── Fetch calendar events ── */
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/admin/calendar");
      const d = await res.json();
      if (d.success) setEvents(d.data);
      else toast.error(refusalMessageOf(d) ?? "Impossible de charger les événements");
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchEvents();
    fetchPaConfig();
  }, [fetchConfigs, fetchEvents, fetchPaConfig]);

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
        toast.success("Configuration sauvegardée");
        setTimeout(() => setSavedKey(null), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(refusalMessageOf(d) ?? "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
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
        toast.success("Commission appliquée à toutes les boutiques");
        setTimeout(() => setCommissionApplied(false), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(refusalMessageOf(d) ?? "Erreur lors de l'application de la commission");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
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
        setNewEvent({
          name: "",
          description: "",
          date: "",
          type: "evenement",
          emoji: "📅",
          alertDaysBefore: 7,
        });
        setShowNewEvent(false);
        toast.success("Événement créé");
        fetchEvents();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(refusalMessageOf(d) ?? "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setCreatingEvent(false);
    }
  };

  /* ── Delete calendar event ── */
  const deleteEvent = async (id: string) => {
    setDeletingEvent(id);
    try {
      const res = await fetch(`/api/admin/calendar/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((evts) => evts.filter((e) => e.id !== id));
        toast.success("Événement supprimé");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
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

  /* ── Save the cap through the platform config writer, which holds it to its rule ── */
  const savePaCap = async () => {
    setPaSaving(true);
    try {
      const res = await fetch("/api/webmaster/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: MAX_INCREASE_PCT_KEY, value: paCap }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setPaCap(d.data.value);
        setPaCapOriginal(d.data.value);
        toast.success("Configuration sauvegardée");
      } else {
        toast.error(refusalMessageOf(d) ?? "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setPaSaving(false);
    }
  };

  const configKeys = Object.keys(CONFIG_META);

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-gray-900 dark:text-white">
          <Settings size={20} /> Paramètres
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Configuration globale de la plateforme
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 1: Platform Config */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Database} title="Configuration plateforme">
        {loadingConfigs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {configKeys.map((key) => {
              const meta = CONFIG_META[key];
              const current = editValues[key] ?? "";
              const original = configs.find((c) => c.key === key)?.value ?? "";
              const changed = current !== original;

              return (
                <div key={key} className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {meta.label}
                    </label>
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                      {meta.description}
                    </p>
                    <input
                      type={meta.type}
                      value={current}
                      onChange={(e) => setEditValues((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={() => saveConfig(key)}
                    disabled={!changed || savingKey === key}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                      savedKey === key
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : changed
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
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
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Appliquer un taux de commission identique à toutes les boutiques actives.
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="max-w-xs flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <span className="w-14 text-right text-lg font-bold text-gray-900 dark:text-white">
                {globalPct}%
              </span>
            </div>
          </div>
          <button
            onClick={applyGlobalCommission}
            disabled={applyingCommission}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
              commissionApplied
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
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
            {commissionApplied
              ? "Appliqué à toutes les boutiques"
              : "Appliquer à toutes les boutiques"}
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-2 dark:bg-amber-500/10">
          <AlertTriangle
            size={14}
            className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Cette action modifie le taux de commission de <strong>toutes</strong> les boutiques. Les
            taux individuels déjà configurés seront écrasés.
          </p>
        </div>
      </Section>

      <Section icon={Mail} title="E-mails commerciaux">
        <CommercialEmailsToggle />
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 3: Calendar Events */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Calendar} title="Événements calendrier">
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Événements de la plateforme (fêtes religieuses, promotions, fermetures). Les alertes sont
          envoyées aux bouchers X jours avant.
        </p>

        {/* Event list */}
        {loadingEvents ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucun événement configuré.
          </p>
        ) : (
          <div className="mb-4 space-y-2">
            {events.map((evt) => (
              <div
                key={evt.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  evt.active
                    ? "border-gray-200 bg-gray-50 dark:border-white/[0.06] dark:bg-white/[0.02]"
                    : "border-gray-100 bg-gray-50/50 opacity-50 dark:border-white/[0.03] dark:bg-white/[0.01]"
                }`}
              >
                <span className="text-lg">{evt.emoji || "📅"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
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
                  className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                    evt.active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                  }`}
                >
                  {evt.active ? "Actif" : "Inactif"}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteEvent(evt.id)}
                  disabled={deletingEvent === evt.id}
                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10"
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
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-500/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Nouvel événement
              </h3>
              <button
                onClick={() => setShowNewEvent(false)}
                className="rounded-lg p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Nom
                </label>
                <input
                  type="text"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent((v) => ({ ...v, name: e.target.value }))}
                  placeholder="Ex: Aïd el-Fitr"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#141414] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Date
                </label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent((v) => ({ ...v, date: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#141414] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#141414] dark:text-white"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#141414] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Description (optionnel)
              </label>
              <input
                type="text"
                value={newEvent.description}
                onChange={(e) => setNewEvent((v) => ({ ...v, description: e.target.value }))}
                placeholder="Description courte"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#141414] dark:text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={createEvent}
                disabled={!newEvent.name || !newEvent.date || creatingEvent}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
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
            className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
          >
            <Plus size={14} /> Ajouter un événement
          </button>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Section 4: Price Adjustment Policy */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Section icon={Scale} title="Politique d'ajustement des prix">
        {loadingPaConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : (
          <MaxIncreaseField
            value={paCap}
            onChange={setPaCap}
            changed={paCap !== paCapOriginal}
            saving={paSaving}
            onSave={savePaCap}
          />
        )}
      </Section>
    </div>
  );
}

/* ================================================================== */
/* ── Price adjustment cap field ─── */
/* ================================================================== */
function MaxIncreaseField({
  value,
  onChange,
  changed,
  saving,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  changed: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="max-increase-pct"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Plafond de sécurité d&apos;un ajustement, en % du total actuel
      </label>
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
        Une hausse ne peut pas dépasser ce pourcentage du total actuel de la commande, même avec
        l&apos;accord du client.
      </p>
      <div className="flex items-center gap-2">
        <input
          id="max-increase-pct"
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        {changed && (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Sauver
          </button>
        )}
      </div>
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
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-[#141414] md:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        <Icon size={16} /> {title}
      </h2>
      {children}
    </div>
  );
}
