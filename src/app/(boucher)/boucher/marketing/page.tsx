// src/app/(boucher)/boucher/marketing/page.tsx — Boucher Marketing Hub V2
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Tag, Plus, Trash2, Pause, Play, Zap, Users, Clock,
  CheckCircle2, XCircle, Inbox, Percent, DollarSign, Truck,
  Gift, Package, ChevronDown, ChevronUp, X, Search,
  ShoppingBag, ImageIcon,
} from "lucide-react";

type PromoCode = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED" | "FREE_FEES" | "BOGO" | "BUNDLE";
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
  _count?: { usages: number; eligibleProducts: number };
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

type ShopProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  inStock: boolean;
};

const DISCOUNT_ICONS: Record<string, typeof Percent> = {
  PERCENT: Percent, FIXED: DollarSign, FREE_FEES: Truck, BOGO: Gift, BUNDLE: Package,
};

const DISCOUNT_LABELS: Record<string, string> = {
  PERCENT: "%", FIXED: "€", FREE_FEES: "Frais offerts", BOGO: "1+1 offert", BUNDLE: "Pack",
};

export default function BoucherMarketingPage() {
  const [tab, setTab] = useState<"codes" | "proposals">("codes");
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [optIns, setOptIns] = useState<OptIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showProducts, setShowProducts] = useState<string | null>(null);

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
    } catch { toast.error("Erreur"); }
  };

  const deleteCode = async (id: string) => {
    try {
      await fetch(`/api/boucher/promo-codes/${id}`, { method: "DELETE" });
      toast.success("Code supprimé");
      fetchCodes();
    } catch { toast.error("Erreur"); }
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
    } catch { toast.error("Erreur"); }
  };

  const pendingCount = optIns.filter((o) => o.status === "PENDING").length;
  const activeCodesCount = codes.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Marketing</h1>
            <p className="text-sm text-gray-500 mt-1">Codes promo, offres BOGO/Pack, propositions Klik&Go</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nouvelle offre
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Tag, value: codes.length, label: "Codes créés", color: "text-[#DC2626]" },
            { icon: Play, value: activeCodesCount, label: "Actifs", color: "text-emerald-500" },
            { icon: Users, value: codes.reduce((sum, c) => sum + c.currentUses, 0), label: "Utilisations", color: "text-blue-500" },
            { icon: Inbox, value: pendingCount, label: "Propositions", color: "text-amber-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</div>
              <div className="text-xs text-gray-500">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 mb-6 border border-[#ece8e3] dark:border-white/10">
          <button
            onClick={() => setTab("codes")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === "codes" ? "bg-[#DC2626] text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Mes offres
          </button>
          <button
            onClick={() => setTab("proposals")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition relative ${
              tab === "proposals" ? "bg-[#DC2626] text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
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
          <CodesTab codes={codes} onToggle={toggleStatus} onDelete={deleteCode} onManageProducts={(id) => setShowProducts(id)} />
        ) : (
          <ProposalsTab optIns={optIns} onRespond={respondOptIn} />
        )}

        {showCreate && (
          <CreatePromoCodeModal onClose={() => setShowCreate(false)} onCreated={() => { fetchCodes(); setShowCreate(false); }} />
        )}
        {showProducts && (
          <ProductSelectionModal codeId={showProducts} onClose={() => setShowProducts(null)} />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CODES TAB
// ══════════════════════════════════════════

function CodesTab({
  codes, onToggle, onDelete, onManageProducts,
}: {
  codes: PromoCode[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onManageProducts: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (codes.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Aucune offre</p>
        <p className="text-sm text-gray-400 mt-1">Créez votre premier code pour attirer des clients</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {codes.map((code) => {
        const expired = new Date(code.endsAt) < new Date();
        const DIcon = DISCOUNT_ICONS[code.discountType] || Tag;
        const isExpanded = expanded === code.id;
        const isBogBundle = code.discountType === "BOGO" || code.discountType === "BUNDLE";
        const discountLabel = code.discountType === "PERCENT"
          ? `-${code.valuePercent}%`
          : code.discountType === "FIXED"
            ? `-${((code.valueCents || 0) / 100).toFixed(0)}€`
            : DISCOUNT_LABELS[code.discountType] || code.discountType;

        return (
          <div
            key={code.id}
            className={`bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 overflow-hidden ${
              expired || code.status === "ARCHIVED" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-3 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                code.status === "ACTIVE" ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-100 dark:bg-white/5"
              }`}>
                <DIcon className={`w-5 h-5 ${code.status === "ACTIVE" ? "text-[#DC2626]" : "text-gray-400"}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{code.code}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-semibold rounded">
                    {discountLabel}
                  </span>
                  {code.isFlash && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded">
                      <Zap className="w-3 h-3" />Flash
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                    code.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                      code.status === "PAUSED" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                        "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  }`}>
                    {code.status === "ACTIVE" ? "Actif" : code.status === "PAUSED" ? "Pause" : "Archivé"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{code.label}</p>
              </div>

              <div className="text-right shrink-0 min-w-[50px]">
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {code.currentUses}{code.maxUses ? `/${code.maxUses}` : ""}
                </div>
                <div className="text-[10px] text-gray-400">utilisations</div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {!expired && code.status !== "ARCHIVED" && (
                  <button onClick={() => onToggle(code.id, code.status)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                    {code.status === "ACTIVE" ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                  </button>
                )}
                {isBogBundle && (
                  <button onClick={() => onManageProducts(code.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Gérer les produits éligibles">
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                  </button>
                )}
                <button onClick={() => setExpanded(isExpanded ? null : code.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => onDelete(code.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-[#ece8e3] dark:border-white/10">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Type</div>
                    <div className="text-gray-700 dark:text-gray-300">{DISCOUNT_LABELS[code.discountType] || code.discountType}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Audience</div>
                    <div className="text-gray-700 dark:text-gray-300">{code.audience}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Expire</div>
                    <div className="text-gray-700 dark:text-gray-300">{new Date(code.endsAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                  {isBogBundle && (
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Produits éligibles</div>
                      <div className="text-gray-700 dark:text-gray-300">
                        {code._count?.eligibleProducts || 0} produit{(code._count?.eligibleProducts || 0) > 1 ? "s" : ""}
                        <button onClick={() => onManageProducts(code.id)} className="ml-2 text-xs text-blue-500 hover:underline">Gérer</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════
// PROPOSALS TAB
// ══════════════════════════════════════════

function ProposalsTab({
  optIns, onRespond,
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
      {optIns.map((optIn) => {
        const isPending = optIn.status === "PENDING";
        return (
          <div
            key={optIn.id}
            className={`bg-white dark:bg-[#141414] rounded-xl border overflow-hidden ${
              isPending
                ? "border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-900"
                : "border-[#ece8e3] dark:border-white/10"
            }`}
          >
            {isPending && (
              <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                En attente de votre réponse
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{optIn.campaign.name}</h3>
                  {optIn.campaign.subject && <p className="text-sm text-gray-500 mt-0.5">{optIn.campaign.subject}</p>}

                  {optIn.campaign.promoCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {optIn.campaign.promoCodes.map((pc) => {
                        const discountStr = pc.discountType === "PERCENT"
                          ? `-${pc.valuePercent}%`
                          : pc.discountType === "FIXED"
                            ? `-${((pc.valueCents || 0) / 100).toFixed(0)}€`
                            : pc.discountType === "BOGO"
                              ? "1+1 offert"
                              : pc.discountType === "BUNDLE"
                                ? "Pack promo"
                                : "Frais offerts";
                        return (
                          <div key={pc.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-white/5 rounded-lg">
                            <Tag className="w-3.5 h-3.5 text-[#DC2626]" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{pc.code}</span>
                                <span className="text-xs font-semibold text-[#DC2626]">{discountStr}</span>
                              </div>
                              <p className="text-xs text-gray-500">{pc.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {optIn.campaign.startsAt && optIn.campaign.endsAt && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Du {new Date(optIn.campaign.startsAt).toLocaleDateString("fr-FR")} au{" "}
                      {new Date(optIn.campaign.endsAt).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>

                {isPending ? (
                  <div className="flex items-center gap-2 ml-3 shrink-0">
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
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 ${
                    optIn.status === "ACCEPTED"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}>
                    {optIn.status === "ACCEPTED" ? "Acceptée" : "Refusée"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════
// CREATE PROMO CODE MODAL V2
// ══════════════════════════════════════════

function CreatePromoCodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED" | "FREE_FEES" | "BOGO" | "BUNDLE",
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

  const u = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const needsValue = form.discountType === "PERCENT" || form.discountType === "FIXED";

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.label.trim()) { toast.error("Code et label requis"); return; }
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
        toast.success("Offre créée !");
        if (form.discountType === "BOGO" || form.discountType === "BUNDLE") {
          toast.info("Pensez à sélectionner les produits éligibles via le bouton 🛍️");
        }
        onCreated();
      } else {
        toast.error(json.error?.message || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-[#141414] border-b border-[#ece8e3] dark:border-white/10 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle offre</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Code */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code promo</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => u({ code: e.target.value.toUpperCase() })}
              placeholder="EX: BIENVENUE10"
              className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white font-mono"
            />
          </div>

          {/* Type — 5 options */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type d&apos;offre</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {(["PERCENT", "FIXED", "FREE_FEES", "BOGO", "BUNDLE"] as const).map((t) => {
                const Icon = DISCOUNT_ICONS[t];
                const labels: Record<string, string> = { PERCENT: "%", FIXED: "€", FREE_FEES: "Frais", BOGO: "BOGO", BUNDLE: "Pack" };
                return (
                  <button
                    key={t}
                    onClick={() => u({ discountType: t })}
                    className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold rounded-lg border transition ${
                      form.discountType === t
                        ? "bg-[#DC2626] text-white border-[#DC2626]"
                        : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {labels[t]}
                  </button>
                );
              })}
            </div>
            {/* Helper text for BOGO/BUNDLE */}
            {form.discountType === "BOGO" && (
              <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" />
                1 acheté = 1 offert. Sélectionnez les produits éligibles après création.
              </p>
            )}
            {form.discountType === "BUNDLE" && (
              <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                Pack promotionnel. Sélectionnez les produits du pack après création.
              </p>
            )}
          </div>

          {/* Value */}
          {form.discountType === "PERCENT" && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage</label>
              <div className="relative mt-1">
                <input
                  type="number" min={1} max={100} value={form.valuePercent}
                  onChange={(e) => u({ valuePercent: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          )}
          {form.discountType === "FIXED" && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant (centimes)</label>
              <input
                type="number" min={100} value={form.valueCents}
                onChange={(e) => u({ valueCents: parseInt(e.target.value) || 0 })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-400 mt-0.5">{(form.valueCents / 100).toFixed(2)} €</p>
            </div>
          )}

          {/* Label */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Label (affiché au client)</label>
            <input
              type="text" value={form.label}
              onChange={(e) => u({ label: e.target.value })}
              placeholder={form.discountType === "BOGO" ? "1 acheté = 1 offert" : form.discountType === "BUNDLE" ? "Pack découverte" : "Ex: 10% de réduction"}
              className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
            />
          </div>

          {/* Duration + limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée (jours)</label>
              <input
                type="number" min={1} max={365} value={form.durationDays}
                onChange={(e) => u({ durationDays: parseInt(e.target.value) || 7 })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limite (vide = ∞)</label>
              <input
                type="number" min={1} value={form.maxUses}
                onChange={(e) => u({ maxUses: e.target.value })}
                placeholder="Illimité"
                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Flash */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isFlash} onChange={(e) => u({ isFlash: e.target.checked })} className="w-4 h-4 rounded border-gray-300 accent-[#DC2626]" />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-500" />Offre flash (notification push)
            </span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#141414] border-t border-[#ece8e3] dark:border-white/10 p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition disabled:opacity-50">
            {saving ? "Création..." : "Créer l'offre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// PRODUCT SELECTION MODAL (BOGO/BUNDLE)
// ══════════════════════════════════════════

function ProductSelectionModal({ codeId, onClose }: { codeId: string; onClose: () => void }) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/boucher/promo-codes/" + codeId + "/products").then((r) => r.json()),
      fetch("/api/boucher/products").then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([existingRes, productsRes]) => {
      if (existingRes.success) {
        const ids = new Set<string>(
          (existingRes.data.products || []).map((p: { product: { id: string } }) => p.product.id)
        );
        setSelected(ids);
      }
      const prods = productsRes.data?.products || productsRes.data || [];
      setProducts(prods);
    }).finally(() => setLoading(false));
  }, [codeId]);

  const toggleProduct = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // POST replaces all eligible products (delete + recreate)
      await fetch(`/api/boucher/promo-codes/${codeId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selected) }),
      });
      toast.success(`${selected.size} produit${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`);
      onClose();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#ece8e3] dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              Produits éligibles
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Sélectionnez les produits concernés par cette offre</p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#ece8e3] dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucun produit trouvé</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((product) => (
                <label
                  key={product.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                    selected.has(product.id)
                      ? "bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800"
                      : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600"
                  />
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">{product.name}</span>
                    <span className="text-xs text-gray-400">{(product.priceCents / 100).toFixed(2)}€ / {product.unit}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#ece8e3] dark:border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm">Annuler</button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : `Enregistrer (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
