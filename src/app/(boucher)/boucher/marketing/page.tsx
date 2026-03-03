// src/app/(boucher)/boucher/marketing/page.tsx — Boucher Marketing Hub
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Tag, Plus, Trash2, Pause, Play, Zap, Users, Clock,
  CheckCircle2, XCircle, Inbox, Percent, DollarSign, Truck,
} from "lucide-react";

type PromoCode = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED" | "FREE_FEES";
  valueCents: number | null;
  valuePercent: number | null;
  label: string;
  description: string | null;
  audience: string;
  status: string;
  startsAt: string;
  endsAt: string;
  isFlash: boolean;
  maxUses: number | null;
  currentUses: number;
  maxUsesPerUser: number;
  _count?: { usages: number };
};

type OptIn = {
  id: string;
  status: string;
  campaign: {
    id: string;
    name: string;
    type: string;
    subject: string | null;
    imageUrl: string | null;
    startsAt: string | null;
    endsAt: string | null;
    promoCodes: Array<{
      id: string;
      code: string;
      discountType: string;
      valueCents: number | null;
      valuePercent: number | null;
      label: string;
    }>;
  };
  createdAt: string;
};

export default function BoucherMarketingPage() {
  const [tab, setTab] = useState<"codes" | "proposals">("codes");
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [optIns, setOptIns] = useState<OptIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/promo-codes");
      const json = await res.json();
      if (json.success) setCodes(json.data);
    } catch { /* */ }
  }, []);

  const fetchOptIns = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/opt-ins");
      const json = await res.json();
      if (json.success) setOptIns(json.data);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchCodes(), fetchOptIns()]).finally(() => setLoading(false));
  }, [fetchCodes, fetchOptIns]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await fetch(`/api/boucher/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === "ACTIVE" ? "Code activé" : "Code mis en pause");
      fetchCodes();
    } catch {
      toast.error("Erreur");
    }
  };

  const deleteCode = async (id: string) => {
    try {
      await fetch(`/api/boucher/promo-codes/${id}`, { method: "DELETE" });
      toast.success("Code supprimé");
      fetchCodes();
    } catch {
      toast.error("Erreur");
    }
  };

  const respondOptIn = async (id: string, action: "accept" | "reject") => {
    try {
      await fetch(`/api/boucher/opt-ins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast.success(action === "accept" ? "Proposition acceptée" : "Proposition refusée");
      fetchOptIns();
    } catch {
      toast.error("Erreur");
    }
  };

  const pendingCount = optIns.filter((o) => o.status === "PENDING").length;
  const activeCodesCount = codes.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              Marketing
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gérez vos codes promo et répondez aux propositions Klik&Go
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nouveau code
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <Tag className="w-5 h-5 text-[#DC2626] mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{codes.length}</div>
            <div className="text-xs text-gray-500">Codes créés</div>
          </div>
          <div className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <Play className="w-5 h-5 text-emerald-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeCodesCount}</div>
            <div className="text-xs text-gray-500">Actifs</div>
          </div>
          <div className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <Users className="w-5 h-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {codes.reduce((sum, c) => sum + c.currentUses, 0)}
            </div>
            <div className="text-xs text-gray-500">Utilisations</div>
          </div>
          <div className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <Inbox className="w-5 h-5 text-amber-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCount}</div>
            <div className="text-xs text-gray-500">Propositions</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 mb-6 border border-[#ece8e3] dark:border-white/10">
          <button
            onClick={() => setTab("codes")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === "codes"
                ? "bg-[#DC2626] text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Mes codes promo
          </button>
          <button
            onClick={() => setTab("proposals")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition relative ${
              tab === "proposals"
                ? "bg-[#DC2626] text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Propositions Klik&Go
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : tab === "codes" ? (
          <CodesTab
            codes={codes}
            onToggle={toggleStatus}
            onDelete={deleteCode}
          />
        ) : (
          <ProposalsTab optIns={optIns} onRespond={respondOptIn} />
        )}

        {/* Create Modal */}
        {showCreate && (
          <CreatePromoCodeModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              fetchCodes();
              setShowCreate(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Codes Tab ──
function CodesTab({
  codes,
  onToggle,
  onDelete,
}: {
  codes: PromoCode[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  if (codes.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Aucun code promo</p>
        <p className="text-sm text-gray-400 mt-1">Créez votre premier code pour attirer des clients</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {codes.map((code) => {
        const expired = new Date(code.endsAt) < new Date();
        const discountLabel =
          code.discountType === "PERCENT"
            ? `-${code.valuePercent}%`
            : code.discountType === "FIXED"
              ? `-${((code.valueCents || 0) / 100).toFixed(0)}€`
              : "Frais offerts";

        return (
          <div
            key={code.id}
            className={`bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 p-4 ${
              expired || code.status === "ARCHIVED" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  {code.discountType === "PERCENT" ? (
                    <Percent className="w-5 h-5 text-[#DC2626]" />
                  ) : code.discountType === "FIXED" ? (
                    <DollarSign className="w-5 h-5 text-[#DC2626]" />
                  ) : (
                    <Truck className="w-5 h-5 text-[#DC2626]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {code.code}
                    </span>
                    <span className="text-xs font-semibold text-[#DC2626]">{discountLabel}</span>
                    {code.isFlash && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded">
                        <Zap className="w-3 h-3" />Flash
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                        code.status === "ACTIVE"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : code.status === "PAUSED"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >
                      {code.status === "ACTIVE" ? "Actif" : code.status === "PAUSED" ? "Pause" : "Archivé"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{code.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!expired && code.status !== "ARCHIVED" && (
                  <button
                    onClick={() => onToggle(code.id, code.status)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
                    title={code.status === "ACTIVE" ? "Mettre en pause" : "Activer"}
                  >
                    {code.status === "ACTIVE" ? (
                      <Pause className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Play className="w-4 h-4 text-emerald-500" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => onDelete(code.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {code.currentUses}{code.maxUses ? `/${code.maxUses}` : ""} utilisations
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expire le {new Date(code.endsAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Proposals Tab ──
function ProposalsTab({
  optIns,
  onRespond,
}: {
  optIns: OptIn[];
  onRespond: (id: string, action: "accept" | "reject") => void;
}) {
  if (optIns.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Aucune proposition</p>
        <p className="text-sm text-gray-400 mt-1">Les propositions de Klik&Go apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {optIns.map((optIn) => (
        <div
          key={optIn.id}
          className="bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {optIn.campaign.name}
              </h3>
              {optIn.campaign.subject && (
                <p className="text-sm text-gray-500 mt-0.5">{optIn.campaign.subject}</p>
              )}
              {optIn.campaign.promoCodes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {optIn.campaign.promoCodes.map((pc) => (
                    <span
                      key={pc.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-semibold rounded-lg"
                    >
                      <Tag className="w-3 h-3" />
                      {pc.code} — {pc.label}
                    </span>
                  ))}
                </div>
              )}
              {optIn.campaign.startsAt && optIn.campaign.endsAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Du {new Date(optIn.campaign.startsAt).toLocaleDateString("fr-FR")} au{" "}
                  {new Date(optIn.campaign.endsAt).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
            {optIn.status === "PENDING" ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRespond(optIn.id, "accept")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accepter
                </button>
                <button
                  onClick={() => onRespond(optIn.id, "reject")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  <XCircle className="w-4 h-4" />
                  Refuser
                </button>
              </div>
            ) : (
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                  optIn.status === "ACCEPTED"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700"
                }`}
              >
                {optIn.status === "ACCEPTED" ? "Acceptée" : "Refusée"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Create Modal ──
function CreatePromoCodeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED" | "FREE_FEES",
    valuePercent: 10,
    valueCents: 500,
    label: "",
    audience: "ALL",
    maxUses: "",
    maxUsesPerUser: 1,
    durationDays: 7,
    isFlash: false,
    minOrderCents: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      toast.error("Code et label requis");
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const endsAt = new Date(now.getTime() + form.durationDays * 86400000);
      const res = await fetch("/api/boucher/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          valueCents: form.discountType === "FIXED" ? form.valueCents : undefined,
          valuePercent: form.discountType === "PERCENT" ? form.valuePercent : undefined,
          label: form.label,
          audience: form.audience,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          maxUsesPerUser: form.maxUsesPerUser,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          isFlash: form.isFlash,
          minOrderCents: form.minOrderCents ? parseInt(form.minOrderCents) * 100 : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Code promo créé !");
        onCreated();
      } else {
        toast.error(json.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nouveau code promo</h2>

          <div className="space-y-4">
            {/* Code */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="EX: BIENVENUE10"
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white font-mono"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type de remise</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["PERCENT", "FIXED", "FREE_FEES"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, discountType: t })}
                    className={`py-2 text-sm font-semibold rounded-lg border transition ${
                      form.discountType === t
                        ? "bg-[#DC2626] text-white border-[#DC2626]"
                        : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {t === "PERCENT" ? "%" : t === "FIXED" ? "€" : "Frais"}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            {form.discountType === "PERCENT" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.valuePercent}
                  onChange={(e) => setForm({ ...form, valuePercent: parseInt(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                />
              </div>
            )}
            {form.discountType === "FIXED" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant (centimes)</label>
                <input
                  type="number"
                  min={100}
                  value={form.valueCents}
                  onChange={(e) => setForm({ ...form, valueCents: parseInt(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-400 mt-0.5">{(form.valueCents / 100).toFixed(2)} €</p>
              </div>
            )}

            {/* Label */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Label (affiché au client)</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Ex: 10% de réduction"
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée (jours)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) || 7 })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
            </div>

            {/* Max uses */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limite d&apos;utilisations (vide = illimité)</label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Illimité"
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
            </div>

            {/* Flash */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFlash}
                onChange={(e) => setForm({ ...form, isFlash: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-500" />
                Offre flash (notification push aux clients)
              </span>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
            >
              {saving ? "Création..." : "Créer le code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
