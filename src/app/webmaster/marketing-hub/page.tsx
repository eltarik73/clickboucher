// src/app/webmaster/marketing-hub/page.tsx — Webmaster Marketing Hub
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Tag, Plus, Trash2, Play, Pause, Eye, Mail, Image as ImageIcon,
  Monitor, Bell, Users, BarChart3, Megaphone, Store,
  CheckCircle2, XCircle, Zap, Globe, Percent, DollarSign, Truck, Clock,
} from "lucide-react";

type PromoCodeData = {
  id: string;
  code: string;
  discountType: string;
  valueCents: number | null;
  valuePercent: number | null;
  scope: string;
  label: string;
  status: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  isFlash: boolean;
  maxUses: number | null;
  currentUses: number;
  shop: { id: string; name: string; slug: string } | null;
  campaign: { id: string; name: string } | null;
  _count: { usages: number; orders: number };
};

type CampaignData = {
  id: string;
  name: string;
  type: string;
  status: string;
  subject: string | null;
  imageUrl: string | null;
  bannerText: string | null;
  popupTitle: string | null;
  segment: string;
  startsAt: string | null;
  endsAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  impressions: number;
  promoCodes: Array<{ id: string; code: string; status: string }>;
  optIns: Array<{ id: string; shopId: string; status: string }>;
  createdAt: string;
};

type Tab = "codes" | "campaigns" | "stats";

export default function MarketingHubPage() {
  const [tab, setTab] = useState<Tab>("codes");
  const [codes, setCodes] = useState<PromoCodeData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [codeStats, setCodeStats] = useState({ total: 0, active: 0, platform: 0, shop: 0, totalUsages: 0 });
  const [campStats, setCampStats] = useState({ total: 0, active: 0, drafts: 0, totalImpressions: 0, totalSent: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/promo-codes");
      const json = await res.json();
      if (json.success) {
        setCodes(json.data.codes);
        setCodeStats(json.data.stats);
      }
    } catch { /* */ }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/marketing-campaigns");
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data.campaigns);
        setCampStats(json.data.stats);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchCodes(), fetchCampaigns()]).finally(() => setLoading(false));
  }, [fetchCodes, fetchCampaigns]);

  const deleteCode = async (id: string) => {
    await fetch(`/api/webmaster/promo-codes/${id}`, { method: "DELETE" });
    toast.success("Code supprimé");
    fetchCodes();
  };

  const toggleCodeStatus = async (id: string, current: string) => {
    const newStatus = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/webmaster/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success(newStatus === "ACTIVE" ? "Code activé" : "Code mis en pause");
    fetchCodes();
  };

  const campaignAction = async (id: string, action: string) => {
    await fetch(`/api/webmaster/marketing-campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    toast.success("Action effectuée");
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/webmaster/marketing-campaigns/${id}`, { method: "DELETE" });
    toast.success("Campagne supprimée");
    fetchCampaigns();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            Marketing Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Codes promo unifiés, campagnes multi-canal, opt-in bouchers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateCode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition"
          >
            <Tag className="w-4 h-4" />
            Code promo
          </button>
          <button
            onClick={() => setShowCreateCampaign(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            <Megaphone className="w-4 h-4" />
            Campagne
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Tag, label: "Codes actifs", value: codeStats.active, color: "text-[#DC2626]" },
          { icon: Globe, label: "Plateforme", value: codeStats.platform, color: "text-blue-500" },
          { icon: Store, label: "Boutique", value: codeStats.shop, color: "text-emerald-500" },
          { icon: Users, label: "Utilisations", value: codeStats.totalUsages, color: "text-amber-500" },
          { icon: Megaphone, label: "Campagnes", value: campStats.active, color: "text-purple-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 border border-[#ece8e3] dark:border-white/10">
        {([
          { key: "codes", label: "Codes promo", icon: Tag },
          { key: "campaigns", label: "Campagnes", icon: Megaphone },
          { key: "stats", label: "Performance", icon: BarChart3 },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === t.key
                ? "bg-[#DC2626] text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : tab === "codes" ? (
        <PromoCodesTable codes={codes} onToggle={toggleCodeStatus} onDelete={deleteCode} />
      ) : tab === "campaigns" ? (
        <CampaignsTable
          campaigns={campaigns}
          onAction={campaignAction}
          onDelete={deleteCampaign}
        />
      ) : (
        <StatsPanel codes={codes} campaigns={campaigns} codeStats={codeStats} campStats={campStats} />
      )}

      {/* Modals */}
      {showCreateCode && (
        <CreateCodeModal onClose={() => setShowCreateCode(false)} onCreated={() => { fetchCodes(); setShowCreateCode(false); }} />
      )}
      {showCreateCampaign && (
        <CreateCampaignModal onClose={() => setShowCreateCampaign(false)} onCreated={() => { fetchCampaigns(); setShowCreateCampaign(false); }} />
      )}
    </div>
  );
}

// ── Promo Codes Table ──
function PromoCodesTable({
  codes,
  onToggle,
  onDelete,
}: {
  codes: PromoCodeData[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  if (codes.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Aucun code promo</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 border-b border-[#ece8e3] dark:border-white/10">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Réduction</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Scope</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Utilisations</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Expire</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ece8e3] dark:divide-white/5">
            {codes.map((code) => {
              const discountLabel = code.discountType === "PERCENT"
                ? `-${code.valuePercent}%`
                : code.discountType === "FIXED"
                  ? `-${((code.valueCents || 0) / 100).toFixed(0)}€`
                  : "Frais offerts";
              const expired = new Date(code.endsAt) < new Date();

              return (
                <tr key={code.id} className={expired ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-white">{code.code}</span>
                      {code.isFlash && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{code.label}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-semibold rounded">
                      {code.discountType === "PERCENT" ? <Percent className="w-3 h-3" /> :
                        code.discountType === "FIXED" ? <DollarSign className="w-3 h-3" /> :
                          <Truck className="w-3 h-3" />}
                      {discountLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      code.scope === "PLATFORM"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {code.scope === "PLATFORM" ? "Plateforme" : "Boutique"}
                    </span>
                    {code.shop && <p className="text-xs text-gray-400 mt-0.5">{code.shop.name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      code.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                        code.status === "PAUSED" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                    }`}>
                      {code.status === "ACTIVE" ? "Actif" : code.status === "PAUSED" ? "Pause" : code.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {code.currentUses}{code.maxUses ? `/${code.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(code.endsAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!expired && (
                        <button onClick={() => onToggle(code.id, code.status)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                          {code.status === "ACTIVE" ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                        </button>
                      )}
                      <button onClick={() => onDelete(code.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Campaigns Table ──
function CampaignsTable({
  campaigns,
  onAction,
  onDelete,
}: {
  campaigns: CampaignData[];
  onAction: (id: string, action: string) => void;
  onDelete: (id: string) => void;
}) {
  const typeIcons: Record<string, typeof Mail> = {
    EMAIL: Mail,
    BANNER: Monitor,
    POPUP: Eye,
    PUSH: Bell,
    BUTCHER_PROMO: Store,
  };
  const typeLabels: Record<string, string> = {
    EMAIL: "Email",
    BANNER: "Bannière",
    POPUP: "Popup",
    PUSH: "Push",
    BUTCHER_PROMO: "Boucher",
  };

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Aucune campagne</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((camp) => {
        const Icon = typeIcons[camp.type] || Megaphone;
        const optInAccepted = camp.optIns.filter((o) => o.status === "ACCEPTED").length;
        const optInPending = camp.optIns.filter((o) => o.status === "PENDING").length;

        return (
          <div key={camp.id} className="bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{camp.name}</h3>
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                      {typeLabels[camp.type] || camp.type}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                      camp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                        camp.status === "DRAFT" ? "bg-gray-100 text-gray-500" :
                          camp.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                    }`}>
                      {camp.status}
                    </span>
                  </div>
                  {camp.subject && <p className="text-sm text-gray-500 mt-0.5">{camp.subject}</p>}
                  {camp.promoCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {camp.promoCodes.map((pc) => (
                        <span key={pc.id} className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-mono rounded">
                          {pc.code}
                        </span>
                      ))}
                    </div>
                  )}
                  {camp.type === "BUTCHER_PROMO" && camp.optIns.length > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {optInAccepted} accepté{optInAccepted > 1 ? "s" : ""}
                      </span>
                      {optInPending > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {optInPending} en attente
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {camp.status === "DRAFT" && (
                  <button
                    onClick={() => onAction(camp.id, "activate")}
                    className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    title="Activer"
                  >
                    <Play className="w-4 h-4 text-emerald-500" />
                  </button>
                )}
                {camp.status === "ACTIVE" && (
                  <button
                    onClick={() => onAction(camp.id, "pause")}
                    className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4 text-amber-500" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(camp.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
            {/* Stats row */}
            {(camp.sentCount > 0 || camp.impressions > 0) && (
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 border-t border-[#ece8e3] dark:border-white/10 pt-3">
                {camp.sentCount > 0 && <span>{camp.sentCount} envois</span>}
                {camp.openCount > 0 && <span>{camp.openCount} ouvertures</span>}
                {camp.clickCount > 0 && <span>{camp.clickCount} clics</span>}
                {camp.impressions > 0 && <span>{camp.impressions} impressions</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stats Panel ──
function StatsPanel({
  codes,
  campaigns,
  codeStats,
  campStats,
}: {
  codes: PromoCodeData[];
  campaigns: CampaignData[];
  codeStats: { total: number; active: number; platform: number; shop: number; totalUsages: number };
  campStats: { total: number; active: number; drafts: number; totalImpressions: number; totalSent: number };
}) {
  // Top codes by usage
  const topCodes = [...codes].sort((a, b) => b.currentUses - a.currentUses).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Overview */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Vue d&apos;ensemble</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Codes actifs</span><span className="font-semibold text-gray-900 dark:text-white">{codeStats.active}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total utilisations</span><span className="font-semibold text-gray-900 dark:text-white">{codeStats.totalUsages}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Campagnes actives</span><span className="font-semibold text-gray-900 dark:text-white">{campStats.active}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Emails envoyés</span><span className="font-semibold text-gray-900 dark:text-white">{campStats.totalSent}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Impressions</span><span className="font-semibold text-gray-900 dark:text-white">{campStats.totalImpressions}</span></div>
        </div>
      </div>

      {/* Top Codes */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top codes promo</h3>
        {topCodes.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune utilisation</p>
        ) : (
          <div className="space-y-2">
            {topCodes.map((code, i) => (
              <div key={code.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">{code.code}</span>
                </div>
                <span className="text-gray-500">{code.currentUses} utilisations</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Code Modal ──
function CreateCodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED" | "FREE_FEES",
    valuePercent: 10,
    valueCents: 500,
    scope: "PLATFORM" as "PLATFORM" | "SHOP",
    label: "",
    audience: "ALL",
    maxUses: "",
    maxUsesPerUser: 1,
    durationDays: 30,
    isFlash: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.label.trim()) { toast.error("Code et label requis"); return; }
    setSaving(true);
    try {
      const now = new Date();
      const endsAt = new Date(now.getTime() + form.durationDays * 86400000);
      const res = await fetch("/api/webmaster/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          valueCents: form.discountType === "FIXED" ? form.valueCents : undefined,
          valuePercent: form.discountType === "PERCENT" ? form.valuePercent : undefined,
          scope: form.scope,
          label: form.label,
          audience: form.audience,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          maxUsesPerUser: form.maxUsesPerUser,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          isFlash: form.isFlash,
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Code créé !"); onCreated(); }
      else toast.error(json.error?.message || "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[85vh] overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nouveau code promo</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
            <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EX: KLIKGO10" className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Scope</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["PLATFORM", "SHOP"] as const).map((s) => (
                <button key={s} onClick={() => setForm({ ...form, scope: s })} className={`py-2 text-sm font-semibold rounded-lg border transition ${form.scope === s ? "bg-[#DC2626] text-white border-[#DC2626]" : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}>
                  {s === "PLATFORM" ? "Plateforme" : "Boutique"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["PERCENT", "FIXED", "FREE_FEES"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, discountType: t })} className={`py-2 text-sm font-semibold rounded-lg border transition ${form.discountType === t ? "bg-[#DC2626] text-white border-[#DC2626]" : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}>
                  {t === "PERCENT" ? "%" : t === "FIXED" ? "€" : "Frais"}
                </button>
              ))}
            </div>
          </div>
          {form.discountType === "PERCENT" && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage</label>
              <input type="number" min={1} max={100} value={form.valuePercent} onChange={(e) => setForm({ ...form, valuePercent: parseInt(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
            </div>
          )}
          {form.discountType === "FIXED" && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant (centimes)</label>
              <input type="number" min={100} value={form.valueCents} onChange={(e) => setForm({ ...form, valueCents: parseInt(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
              <p className="text-xs text-gray-400 mt-0.5">{(form.valueCents / 100).toFixed(2)} €</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Label</label>
            <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="10% sur votre commande" className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée (jours)</label>
            <input type="number" min={1} max={365} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) || 30 })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limite (vide = illimité)</label>
            <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Illimité" className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isFlash} onChange={(e) => setForm({ ...form, isFlash: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" />Offre flash</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50">
            {saving ? "Création..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Campaign Modal ──
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    type: "BANNER" as "EMAIL" | "BANNER" | "POPUP" | "PUSH" | "BUTCHER_PROMO",
    subject: "",
    bannerText: "",
    popupTitle: "",
    popupMessage: "",
    imageUrl: "",
    linkUrl: "",
    segment: "ALL",
    durationDays: 7,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const now = new Date();
      const endsAt = new Date(now.getTime() + form.durationDays * 86400000);
      const res = await fetch("/api/webmaster/marketing-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          subject: form.subject || undefined,
          bannerText: form.bannerText || undefined,
          popupTitle: form.popupTitle || undefined,
          popupMessage: form.popupMessage || undefined,
          imageUrl: form.imageUrl || undefined,
          linkUrl: form.linkUrl || undefined,
          segment: form.segment,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Campagne créée !"); onCreated(); }
      else toast.error(json.error?.message || "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[85vh] overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nouvelle campagne</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Promo Printemps" className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {(["BANNER", "POPUP", "EMAIL", "PUSH", "BUTCHER_PROMO"] as const).map((t) => {
                const labels: Record<string, string> = { BANNER: "Bannière", POPUP: "Popup", EMAIL: "Email", PUSH: "Push", BUTCHER_PROMO: "Boucher" };
                return (
                  <button key={t} onClick={() => setForm({ ...form, type: t })} className={`py-2 text-xs font-semibold rounded-lg border transition ${form.type === t ? "bg-[#DC2626] text-white border-[#DC2626]" : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}>
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          </div>
          {form.type === "BANNER" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Texte bannière</label>
                <input type="text" value={form.bannerText} onChange={(e) => setForm({ ...form, bannerText: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
              </div>
            </>
          )}
          {form.type === "POPUP" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Titre popup</label>
                <input type="text" value={form.popupTitle} onChange={(e) => setForm({ ...form, popupTitle: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message popup</label>
                <textarea value={form.popupMessage} onChange={(e) => setForm({ ...form, popupMessage: e.target.value })} rows={3} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
              </div>
            </>
          )}
          {form.type === "EMAIL" && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sujet email</label>
              <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée (jours)</label>
            <input type="number" min={1} max={365} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) || 7 })} className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50">
            {saving ? "Création..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
