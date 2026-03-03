// src/app/webmaster/marketing-hub/page.tsx — Webmaster Marketing Hub V2
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Tag, Plus, Trash2, Play, Pause, Eye, Mail, Image as ImageIcon,
  Monitor, Bell, Users, BarChart3, Megaphone, Store,
  CheckCircle2, XCircle, Zap, Globe, Percent, DollarSign, Truck, Clock,
  Package, Gift, Send, TrendingUp, ArrowUpRight, MousePointerClick,
  Paintbrush, ChevronDown, ChevronUp, Copy, Search, Filter, X,
  ShoppingBag, BadgePercent, Layers, Palette, LayoutDashboard,
} from "lucide-react";

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

type PromoCodeData = {
  id: string;
  code: string;
  discountType: string;
  valueCents: number | null;
  valuePercent: number | null;
  scope: string;
  label: string;
  description: string | null;
  status: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  isFlash: boolean;
  maxUses: number | null;
  currentUses: number;
  payer: string;
  diffBadge: boolean;
  diffBanner: boolean;
  diffPopup: boolean;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerColor: string | null;
  bannerPosition: string | null;
  bannerImageUrl: string | null;
  popupTitle: string | null;
  popupMessage: string | null;
  popupColor: string | null;
  popupFrequency: string | null;
  popupImageUrl: string | null;
  shop: { id: string; name: string; slug: string } | null;
  campaign: { id: string; name: string } | null;
  _count: { usages: number; orders: number; eligibleProducts: number };
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

type ShopData = { id: string; name: string; slug: string };

type MarketingStats = {
  kpis: {
    activeOffers: number;
    campaignsThisMonth: number;
    conversions: number;
    emailsSent: number;
  };
  topCodes: Array<{
    id: string;
    code: string;
    label: string;
    discountType: string;
    valueCents: number | null;
    valuePercent: number | null;
    currentUses: number;
    payer: string;
    _count: { orders: number };
  }>;
  monthlyStats: {
    ordersWithPromo: number;
    revenueFromPromos: number;
    discountTotal: number;
    roi: number;
    emailsSent: number;
  };
  campaignPerformance: {
    clients: { totalSent: number; openRate: number; clickRate: number };
    bouchers: { totalSent: number; openRate: number; clickRate: number };
  };
};

type Tab = "codes" | "campaigns" | "stats";

// ══════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════

const DISCOUNT_LABELS: Record<string, string> = {
  PERCENT: "Pourcentage",
  FIXED: "Montant fixe",
  FREE_FEES: "Frais offerts",
  BOGO: "1 acheté = 1 offert",
  BUNDLE: "Pack promo",
};

const DISCOUNT_ICONS: Record<string, typeof Percent> = {
  PERCENT: Percent,
  FIXED: DollarSign,
  FREE_FEES: Truck,
  BOGO: Gift,
  BUNDLE: Package,
};

const COLOR_MAP: Record<string, string> = {
  red: "bg-gradient-to-r from-[#DC2626] to-[#ef4444]",
  black: "bg-gradient-to-r from-gray-900 to-gray-700",
  green: "bg-gradient-to-r from-emerald-600 to-emerald-500",
  orange: "bg-gradient-to-r from-orange-500 to-amber-500",
  blue: "bg-gradient-to-r from-blue-600 to-blue-500",
};

const COLOR_OPTIONS = [
  { value: "red", label: "Rouge", class: "bg-[#DC2626]" },
  { value: "black", label: "Noir", class: "bg-gray-900" },
  { value: "green", label: "Vert", class: "bg-emerald-600" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "blue", label: "Bleu", class: "bg-blue-600" },
];

// ══════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════

export default function MarketingHubPage() {
  const [tab, setTab] = useState<Tab>("codes");
  const [codes, setCodes] = useState<PromoCodeData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [shops, setShops] = useState<ShopData[]>([]);
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [codeStats, setCodeStats] = useState({ total: 0, active: 0, platform: 0, shop: 0, totalUsages: 0 });
  const [campStats, setCampStats] = useState({ total: 0, active: 0, drafts: 0, totalImpressions: 0, totalSent: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showPropose, setShowPropose] = useState<string | null>(null);

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

  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch("/api/shops?limit=100");
      const json = await res.json();
      if (json.success) setShops(json.data?.shops || json.data || []);
    } catch { /* */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/marketing-stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchCodes(), fetchCampaigns(), fetchShops(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchCodes, fetchCampaigns, fetchShops, fetchStats]);

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

  // KPIs from real stats
  const kpis = stats?.kpis || { activeOffers: codeStats.active, campaignsThisMonth: 0, conversions: 0, emailsSent: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            Marketing Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Offres, campagnes multi-canal, diffusion, opt-in bouchers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateCode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nouvelle offre
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BadgePercent, label: "Offres actives", value: kpis.activeOffers, color: "text-[#DC2626]", bg: "bg-red-50 dark:bg-red-900/20" },
          { icon: TrendingUp, label: "Conversions ce mois", value: kpis.conversions, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { icon: Megaphone, label: "Campagnes ce mois", value: kpis.campaignsThisMonth, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { icon: Mail, label: "Emails envoyés", value: kpis.emailsSent, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-[#ece8e3] dark:border-white/10">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-[#141414] rounded-xl p-1 border border-[#ece8e3] dark:border-white/10">
        {([
          { key: "codes", label: "Offres", icon: Tag, count: codeStats.active },
          { key: "campaigns", label: "Campagnes", icon: Megaphone, count: campStats.active },
          { key: "stats", label: "Performance", icon: BarChart3, count: undefined },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "stats") fetchStats(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === t.key
                ? "bg-[#DC2626] text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? "bg-white/20" : "bg-gray-100 dark:bg-white/10"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : tab === "codes" ? (
        <PromoCodesTab
          codes={codes}
          onToggle={toggleCodeStatus}
          onDelete={deleteCode}
          onPropose={(id) => setShowPropose(id)}
        />
      ) : tab === "campaigns" ? (
        <CampaignsTab
          campaigns={campaigns}
          onAction={campaignAction}
          onDelete={deleteCampaign}
        />
      ) : (
        <StatsTab stats={stats} />
      )}

      {/* Modals */}
      {showCreateCode && (
        <CreateCodeModal
          shops={shops}
          onClose={() => setShowCreateCode(false)}
          onCreated={() => { fetchCodes(); setShowCreateCode(false); }}
        />
      )}
      {showCreateCampaign && (
        <CreateCampaignModal
          onClose={() => setShowCreateCampaign(false)}
          onCreated={() => { fetchCampaigns(); setShowCreateCampaign(false); }}
        />
      )}
      {showPropose && (
        <ProposeModal
          codeId={showPropose}
          shops={shops}
          onClose={() => setShowPropose(null)}
          onDone={() => { fetchCodes(); fetchCampaigns(); setShowPropose(null); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// PROMO CODES TAB
// ══════════════════════════════════════════

function PromoCodesTab({
  codes,
  onToggle,
  onDelete,
  onPropose,
}: {
  codes: PromoCodeData[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onPropose: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = codes.filter((c) => {
    if (search && !c.code.toLowerCase().includes(search.toLowerCase()) && !c.label.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && c.discountType !== filterType) return false;
    return true;
  });

  if (codes.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium text-lg">Aucune offre</p>
        <p className="text-sm text-gray-400 mt-1">Créez votre première offre promotionnelle</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un code..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#ece8e3] dark:border-white/10 rounded-lg bg-white dark:bg-[#141414] text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: "all", label: "Tous" },
            { key: "PERCENT", label: "%" },
            { key: "FIXED", label: "€" },
            { key: "FREE_FEES", label: "Frais" },
            { key: "BOGO", label: "BOGO" },
            { key: "BUNDLE", label: "Pack" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                filterType === f.key
                  ? "bg-[#DC2626] text-white border-[#DC2626]"
                  : "border-[#ece8e3] dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map((code) => {
          const DIcon = DISCOUNT_ICONS[code.discountType] || Tag;
          const expired = new Date(code.endsAt) < new Date();
          const isExpanded = expanded === code.id;
          const discountLabel = code.discountType === "PERCENT"
            ? `-${code.valuePercent}%`
            : code.discountType === "FIXED"
              ? `-${((code.valueCents || 0) / 100).toFixed(0)}€`
              : code.discountType === "BOGO"
                ? "1+1 offert"
                : code.discountType === "BUNDLE"
                  ? "Pack"
                  : "Frais offerts";

          return (
            <div
              key={code.id}
              className={`bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 overflow-hidden transition ${expired ? "opacity-60" : ""}`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 p-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  code.status === "ACTIVE" ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-100 dark:bg-white/5"
                }`}>
                  <DIcon className={`w-5 h-5 ${code.status === "ACTIVE" ? "text-[#DC2626]" : "text-gray-400"}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{code.code}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-semibold rounded">
                      {discountLabel}
                    </span>
                    {code.isFlash && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                    {/* Payer badge */}
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                      code.payer === "KLIKGO"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                    }`}>
                      {code.payer === "KLIKGO" ? "Klik&Go" : "Boucher"}
                    </span>
                    {/* Scope */}
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                      code.scope === "PLATFORM"
                        ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {code.scope === "PLATFORM" ? "Plateforme" : "Boutique"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{code.label}</p>
                </div>

                {/* Diffusion icons */}
                <div className="flex items-center gap-1 shrink-0">
                  {code.diffBadge && (
                    <span className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 dark:bg-white/5" title="Badge">
                      <BadgePercent className="w-3.5 h-3.5 text-gray-500" />
                    </span>
                  )}
                  {code.diffBanner && (
                    <span className="w-6 h-6 rounded flex items-center justify-center bg-amber-50 dark:bg-amber-900/20" title="Bannière">
                      <LayoutDashboard className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                  )}
                  {code.diffPopup && (
                    <span className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 dark:bg-blue-900/20" title="Popup">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                  )}
                </div>

                {/* Status */}
                <span className={`px-2 py-0.5 text-xs font-semibold rounded shrink-0 ${
                  code.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                    code.status === "PAUSED" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      "bg-gray-100 dark:bg-white/10 text-gray-500"
                }`}>
                  {code.status === "ACTIVE" ? "Actif" : code.status === "PAUSED" ? "Pause" : code.status}
                </span>

                {/* Stats */}
                <div className="text-right shrink-0 min-w-[60px]">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {code.currentUses}{code.maxUses ? `/${code.maxUses}` : ""}
                  </div>
                  <div className="text-[10px] text-gray-400">utilisations</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {!expired && (
                    <button onClick={() => onToggle(code.id, code.status)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5" title={code.status === "ACTIVE" ? "Mettre en pause" : "Activer"}>
                      {code.status === "ACTIVE" ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                    </button>
                  )}
                  {code.scope === "PLATFORM" && !expired && (
                    <button onClick={() => onPropose(code.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Proposer aux bouchers">
                      <Send className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : code.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => onDelete(code.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-[#ece8e3] dark:border-white/10">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Type</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{DISCOUNT_LABELS[code.discountType] || code.discountType}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Audience</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{code.audience}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Expire le</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{new Date(code.endsAt).toLocaleDateString("fr-FR")}</div>
                    </div>
                    {code.shop && (
                      <div>
                        <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Boutique</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">{code.shop.name}</div>
                      </div>
                    )}
                    {(code.discountType === "BOGO" || code.discountType === "BUNDLE") && (
                      <div>
                        <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Produits éligibles</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {code._count?.eligibleProducts || 0} produit{(code._count?.eligibleProducts || 0) > 1 ? "s" : ""}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Diffusion preview */}
                  {(code.diffBanner || code.diffPopup) && (
                    <div className="mt-4 space-y-3">
                      <div className="text-[10px] uppercase text-gray-400 font-semibold">Aperçu diffusion</div>
                      <div className="flex gap-3 flex-wrap">
                        {code.diffBanner && code.bannerTitle && (
                          <BannerPreview
                            title={code.bannerTitle}
                            subtitle={code.bannerSubtitle || ""}
                            color={code.bannerColor || "red"}
                            code={code.code}
                          />
                        )}
                        {code.diffPopup && code.popupTitle && (
                          <PopupPreview
                            title={code.popupTitle}
                            message={code.popupMessage || ""}
                            color={code.popupColor || "red"}
                            code={code.code}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {code.campaign && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <Megaphone className="w-3.5 h-3.5" />
                      Campagne : <span className="font-semibold">{code.campaign.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// BANNER & POPUP PREVIEWS
// ══════════════════════════════════════════

function BannerPreview({ title, subtitle, color, code }: { title: string; subtitle: string; color: string; code: string }) {
  return (
    <div className={`${COLOR_MAP[color] || COLOR_MAP.red} rounded-lg p-3 text-white min-w-[280px] max-w-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-sm">{title}</div>
          {subtitle && <div className="text-xs text-white/80 mt-0.5">{subtitle}</div>}
        </div>
        <div className="bg-white/20 backdrop-blur rounded-md px-2 py-1 font-mono text-xs font-bold">{code}</div>
      </div>
    </div>
  );
}

function PopupPreview({ title, message, color, code }: { title: string; message: string; color: string; code: string }) {
  const borderColor = color === "red" ? "border-[#DC2626]" : color === "blue" ? "border-blue-600" : color === "green" ? "border-emerald-600" : color === "orange" ? "border-orange-500" : "border-gray-900";
  return (
    <div className={`bg-white dark:bg-[#1a1a1a] rounded-xl border-2 ${borderColor} p-3 min-w-[220px] max-w-[260px] shadow-lg`}>
      <div className="font-bold text-sm text-gray-900 dark:text-white">{title}</div>
      {message && <p className="text-xs text-gray-500 mt-1">{message}</p>}
      <div className="mt-2 bg-gray-100 dark:bg-white/10 rounded-md px-2 py-1 text-center font-mono text-xs font-bold text-gray-900 dark:text-white">{code}</div>
    </div>
  );
}

// ══════════════════════════════════════════
// CAMPAIGNS TAB
// ══════════════════════════════════════════

function CampaignsTab({
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
      <div className="text-center py-16 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium text-lg">Aucune campagne</p>
        <p className="text-sm text-gray-400 mt-1">Créez votre première campagne marketing</p>
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
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  camp.status === "ACTIVE" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-100 dark:bg-white/5"
                }`}>
                  <Icon className={`w-5 h-5 ${camp.status === "ACTIVE" ? "text-emerald-600" : "text-gray-500"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{camp.name}</h3>
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                      {typeLabels[camp.type] || camp.type}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                      camp.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                        camp.status === "DRAFT" ? "bg-gray-100 dark:bg-white/10 text-gray-500" :
                          camp.status === "COMPLETED" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    }`}>
                      {camp.status === "ACTIVE" ? "Actif" : camp.status === "DRAFT" ? "Brouillon" : camp.status === "COMPLETED" ? "Terminé" : camp.status}
                    </span>
                  </div>
                  {camp.subject && <p className="text-sm text-gray-500 mt-0.5">{camp.subject}</p>}
                  {camp.promoCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {camp.promoCodes.map((pc) => (
                        <span key={pc.id} className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-[#DC2626] text-xs font-mono font-bold rounded">
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
              <div className="flex items-center gap-4 mt-3 text-xs border-t border-[#ece8e3] dark:border-white/10 pt-3">
                {camp.sentCount > 0 && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Send className="w-3 h-3" /> {camp.sentCount} envois
                  </span>
                )}
                {camp.openCount > 0 && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Eye className="w-3 h-3" /> {camp.openCount} ouvertures
                    {camp.sentCount > 0 && <span className="text-emerald-500 font-semibold">({Math.round(camp.openCount / camp.sentCount * 100)}%)</span>}
                  </span>
                )}
                {camp.clickCount > 0 && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <MousePointerClick className="w-3 h-3" /> {camp.clickCount} clics
                  </span>
                )}
                {camp.impressions > 0 && (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Eye className="w-3 h-3" /> {camp.impressions} impressions
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════
// STATS TAB — Real data from /api/webmaster/marketing-stats
// ══════════════════════════════════════════

function StatsTab({ stats }: { stats: MarketingStats | null }) {
  if (!stats) {
    return (
      <div className="text-center py-16 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Chargement des statistiques...</p>
      </div>
    );
  }

  const { kpis, topCodes, monthlyStats, campaignPerformance } = stats;

  return (
    <div className="space-y-6">
      {/* Monthly overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Commandes avec promo",
            value: monthlyStats.ordersWithPromo,
            icon: ShoppingBag,
            color: "text-[#DC2626]",
            bg: "bg-red-50 dark:bg-red-900/20",
          },
          {
            label: "CA généré (promos)",
            value: `${(monthlyStats.revenueFromPromos / 100).toFixed(0)}€`,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
          },
          {
            label: "Réductions accordées",
            value: `${(monthlyStats.discountTotal / 100).toFixed(0)}€`,
            icon: BadgePercent,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
          },
          {
            label: "ROI",
            value: `${monthlyStats.roi}x`,
            icon: ArrowUpRight,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            sub: monthlyStats.roi > 1 ? "Rentable" : "Améliorer",
          },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-[#141414] rounded-xl border border-[#ece8e3] dark:border-white/10 p-4">
            <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
              <m.icon className={`w-5 h-5 ${m.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{m.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
            {m.sub && (
              <div className={`text-[10px] font-semibold mt-1 ${monthlyStats.roi > 1 ? "text-emerald-500" : "text-amber-500"}`}>
                {m.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top codes */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#DC2626]" />
            Top codes promo
          </h3>
          {topCodes.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune utilisation ce mois</p>
          ) : (
            <div className="space-y-2.5">
              {topCodes.map((code, i) => {
                const discountLabel = code.discountType === "PERCENT"
                  ? `-${code.valuePercent}%`
                  : code.discountType === "FIXED"
                    ? `-${((code.valueCents || 0) / 100).toFixed(0)}€`
                    : code.discountType === "BOGO" ? "BOGO" : code.discountType === "BUNDLE" ? "Pack" : "Frais";
                return (
                  <div key={code.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{code.code}</span>
                          <span className="text-xs text-[#DC2626] font-semibold">{discountLabel}</span>
                        </div>
                        <p className="text-xs text-gray-400">{code.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{code.currentUses}</div>
                      <div className="text-[10px] text-gray-400">{code._count.orders} commandes</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaign performance */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600" />
            Performance campagnes
          </h3>
          <div className="space-y-4">
            {/* Clients */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Campagnes clients</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{campaignPerformance.clients.totalSent}</div>
                  <div className="text-[10px] text-gray-400">Envoyés</div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-600">{campaignPerformance.clients.openRate}%</div>
                  <div className="text-[10px] text-gray-400">Taux ouverture</div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{campaignPerformance.clients.clickRate}%</div>
                  <div className="text-[10px] text-gray-400">Taux clic</div>
                </div>
              </div>
            </div>
            {/* Bouchers */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Campagnes bouchers</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{campaignPerformance.bouchers.totalSent}</div>
                  <div className="text-[10px] text-gray-400">Envoyés</div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-600">{campaignPerformance.bouchers.openRate}%</div>
                  <div className="text-[10px] text-gray-400">Taux ouverture</div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{campaignPerformance.bouchers.clickRate}%</div>
                  <div className="text-[10px] text-gray-400">Taux clic</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CREATE CODE MODAL V2
// ══════════════════════════════════════════

type CreateCodeForm = {
  code: string;
  discountType: "PERCENT" | "FIXED" | "FREE_FEES" | "BOGO" | "BUNDLE";
  valuePercent: number;
  valueCents: number;
  scope: "PLATFORM" | "SHOP";
  shopId: string;
  label: string;
  description: string;
  audience: string;
  maxUses: string;
  maxUsesPerUser: number;
  durationDays: number;
  isFlash: boolean;
  payer: "KLIKGO" | "BUTCHER";
  diffBadge: boolean;
  diffBanner: boolean;
  diffPopup: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerColor: "red" | "black" | "green" | "orange" | "blue";
  bannerPosition: "discover_top" | "shop_page" | "all_pages";
  popupTitle: string;
  popupMessage: string;
  popupColor: "red" | "black" | "green" | "orange" | "blue";
  popupFrequency: "once_user" | "once_day" | "every_visit";
};

function CreateCodeModal({
  shops,
  onClose,
  onCreated,
}: {
  shops: ShopData[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1); // 1=base, 2=diffusion, 3=preview
  const [form, setForm] = useState<CreateCodeForm>({
    code: "",
    discountType: "PERCENT",
    valuePercent: 10,
    valueCents: 500,
    scope: "PLATFORM",
    shopId: "",
    label: "",
    description: "",
    audience: "ALL",
    maxUses: "",
    maxUsesPerUser: 1,
    durationDays: 30,
    isFlash: false,
    payer: "KLIKGO",
    diffBadge: true,
    diffBanner: false,
    diffPopup: false,
    bannerTitle: "",
    bannerSubtitle: "",
    bannerColor: "red",
    bannerPosition: "discover_top",
    popupTitle: "",
    popupMessage: "",
    popupColor: "red",
    popupFrequency: "once_user",
  });
  const [saving, setSaving] = useState(false);

  const u = (patch: Partial<CreateCodeForm>) => setForm({ ...form, ...patch });

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.label.trim()) { toast.error("Code et label requis"); return; }
    if (form.scope === "SHOP" && !form.shopId) { toast.error("Sélectionnez une boutique"); return; }
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
          shopId: form.scope === "SHOP" ? form.shopId : undefined,
          label: form.label,
          description: form.description || undefined,
          audience: form.audience,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          maxUsesPerUser: form.maxUsesPerUser,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          isFlash: form.isFlash,
          payer: form.payer,
          diffBadge: form.diffBadge,
          diffBanner: form.diffBanner,
          diffPopup: form.diffPopup,
          ...(form.diffBanner ? {
            bannerTitle: form.bannerTitle || undefined,
            bannerSubtitle: form.bannerSubtitle || undefined,
            bannerColor: form.bannerColor,
            bannerPosition: form.bannerPosition,
          } : {}),
          ...(form.diffPopup ? {
            popupTitle: form.popupTitle || undefined,
            popupMessage: form.popupMessage || undefined,
            popupColor: form.popupColor,
            popupFrequency: form.popupFrequency,
          } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Offre créée !"); onCreated(); }
      else toast.error(json.error?.message || "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-lg border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header with steps */}
        <div className="sticky top-0 z-10 bg-white dark:bg-[#141414] border-b border-[#ece8e3] dark:border-white/10 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle offre</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          {/* Step indicators */}
          <div className="flex gap-1 mt-3">
            {[
              { n: 1, label: "Offre" },
              { n: 2, label: "Diffusion" },
              { n: 3, label: "Aperçu" },
            ].map((s) => (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  step === s.n
                    ? "bg-[#DC2626] text-white"
                    : step > s.n
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-100 dark:bg-white/5 text-gray-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Step 1: Base info ── */}
          {step === 1 && (
            <>
              {/* Code */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code promo</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => u({ code: e.target.value.toUpperCase() })}
                  placeholder="EX: KLIKGO10"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white font-mono"
                />
              </div>

              {/* Type de réduction */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type de réduction</label>
                <div className="grid grid-cols-5 gap-1.5 mt-1">
                  {(["PERCENT", "FIXED", "FREE_FEES", "BOGO", "BUNDLE"] as const).map((t) => {
                    const Icon = DISCOUNT_ICONS[t];
                    const labels: Record<string, string> = { PERCENT: "%", FIXED: "€", FREE_FEES: "Frais", BOGO: "BOGO", BUNDLE: "Pack" };
                    return (
                      <button
                        key={t}
                        onClick={() => u({ discountType: t })}
                        className={`flex flex-col items-center gap-1 py-2 text-xs font-semibold rounded-lg border transition ${
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
              </div>

              {/* Value fields */}
              {form.discountType === "PERCENT" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.valuePercent}
                      onChange={(e) => u({ valuePercent: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              )}
              {form.discountType === "FIXED" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant de réduction</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={form.valueCents}
                      onChange={(e) => u({ valueCents: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{(form.valueCents / 100).toFixed(2)} €</p>
                </div>
              )}

              {/* Scope + Shop */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Portée</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["PLATFORM", "SHOP"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => u({ scope: s })}
                      className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg border transition ${
                        form.scope === s
                          ? "bg-[#DC2626] text-white border-[#DC2626]"
                          : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {s === "PLATFORM" ? <Globe className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                      {s === "PLATFORM" ? "Plateforme" : "Boutique"}
                    </button>
                  ))}
                </div>
              </div>
              {form.scope === "SHOP" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Boutique</label>
                  <select
                    value={form.shopId}
                    onChange={(e) => u({ shopId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                  >
                    <option value="">Sélectionner...</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payer */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Financé par</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["KLIKGO", "BUTCHER"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => u({ payer: p })}
                      className={`py-2 text-sm font-semibold rounded-lg border transition ${
                        form.payer === p
                          ? p === "KLIKGO"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-orange-500 text-white border-orange-500"
                          : "border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {p === "KLIKGO" ? "Klik&Go" : "Boucher"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label + desc */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Label (affiché au client)</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => u({ label: e.target.value })}
                  placeholder="10% sur votre commande"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                />
              </div>

              {/* Duration + limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée (jours)</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.durationDays}
                    onChange={(e) => u({ durationDays: parseInt(e.target.value) || 30 })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Limite (vide = ∞)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxUses}
                    onChange={(e) => u({ maxUses: e.target.value })}
                    placeholder="Illimité"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Flash */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isFlash}
                  onChange={(e) => u({ isFlash: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 accent-[#DC2626]"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Zap className="w-4 h-4 text-amber-500" />Offre flash (urgence)
                </span>
              </label>
            </>
          )}

          {/* ── Step 2: Diffusion ── */}
          {step === 2 && (
            <>
              <div className="text-sm text-gray-500 mb-2">
                Choisissez comment diffuser cette offre auprès des clients.
              </div>

              {/* Channel toggles */}
              <div className="space-y-3">
                {[
                  { key: "diffBadge" as const, label: "Badge sur carte boutique", desc: "Badge rouge visible dans la liste des boutiques", icon: BadgePercent },
                  { key: "diffBanner" as const, label: "Bannière promotionnelle", desc: "Bandeau coloré en haut de page", icon: LayoutDashboard },
                  { key: "diffPopup" as const, label: "Popup d'offre", desc: "Popup modale à l'ouverture du site", icon: Eye },
                ].map((ch) => (
                  <label
                    key={ch.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      form[ch.key]
                        ? "border-[#DC2626] bg-red-50/50 dark:bg-red-900/10"
                        : "border-[#ece8e3] dark:border-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form[ch.key]}
                      onChange={(e) => u({ [ch.key]: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#DC2626]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ch.icon className={`w-4 h-4 ${form[ch.key] ? "text-[#DC2626]" : "text-gray-400"}`} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{ch.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{ch.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Banner editor */}
              {form.diffBanner && (
                <div className="mt-4 space-y-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Paintbrush className="w-4 h-4 text-[#DC2626]" />
                    Éditeur de bannière
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Titre</label>
                    <input
                      type="text"
                      value={form.bannerTitle}
                      onChange={(e) => u({ bannerTitle: e.target.value })}
                      placeholder="Offre spéciale !"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sous-titre</label>
                    <input
                      type="text"
                      value={form.bannerSubtitle}
                      onChange={(e) => u({ bannerSubtitle: e.target.value })}
                      placeholder="Profitez de -10% sur votre commande"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                  </div>
                  {/* Color picker */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Couleur</label>
                    <div className="flex gap-2 mt-1">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => u({ bannerColor: c.value as CreateCodeForm["bannerColor"] })}
                          className={`w-8 h-8 rounded-full ${c.class} transition ring-2 ring-offset-2 ${
                            form.bannerColor === c.value ? "ring-[#DC2626]" : "ring-transparent"
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Position */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Position</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {([
                        { value: "discover_top", label: "Page découvrir" },
                        { value: "shop_page", label: "Page boutique" },
                        { value: "all_pages", label: "Toutes pages" },
                      ] as const).map((p) => (
                        <button
                          key={p.value}
                          onClick={() => u({ bannerPosition: p.value })}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                            form.bannerPosition === p.value
                              ? "bg-[#DC2626] text-white border-[#DC2626]"
                              : "border-gray-300 dark:border-white/10 text-gray-500"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Live preview */}
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Aperçu</div>
                    <BannerPreview
                      title={form.bannerTitle || "Titre de la bannière"}
                      subtitle={form.bannerSubtitle || "Sous-titre de la bannière"}
                      color={form.bannerColor}
                      code={form.code || "CODE"}
                    />
                  </div>
                </div>
              )}

              {/* Popup editor */}
              {form.diffPopup && (
                <div className="mt-4 space-y-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Paintbrush className="w-4 h-4 text-blue-600" />
                    Éditeur de popup
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Titre</label>
                    <input
                      type="text"
                      value={form.popupTitle}
                      onChange={(e) => u({ popupTitle: e.target.value })}
                      placeholder="Ne ratez pas cette offre !"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Message</label>
                    <textarea
                      value={form.popupMessage}
                      onChange={(e) => u({ popupMessage: e.target.value })}
                      rows={3}
                      placeholder="Utilisez le code pour profiter de la réduction..."
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
                    />
                  </div>
                  {/* Color */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Couleur bordure</label>
                    <div className="flex gap-2 mt-1">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => u({ popupColor: c.value as CreateCodeForm["popupColor"] })}
                          className={`w-8 h-8 rounded-full ${c.class} transition ring-2 ring-offset-2 ${
                            form.popupColor === c.value ? "ring-[#DC2626]" : "ring-transparent"
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Frequency */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fréquence d&apos;affichage</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {([
                        { value: "once_user", label: "1 seule fois" },
                        { value: "once_day", label: "1 fois/jour" },
                        { value: "every_visit", label: "Chaque visite" },
                      ] as const).map((f) => (
                        <button
                          key={f.value}
                          onClick={() => u({ popupFrequency: f.value })}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                            form.popupFrequency === f.value
                              ? "bg-[#DC2626] text-white border-[#DC2626]"
                              : "border-gray-300 dark:border-white/10 text-gray-500"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Live preview */}
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Aperçu</div>
                    <PopupPreview
                      title={form.popupTitle || "Titre du popup"}
                      message={form.popupMessage || "Message du popup"}
                      color={form.popupColor}
                      code={form.code || "CODE"}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 mb-2">Vérifiez votre offre avant de la créer.</div>

              {/* Summary card */}
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    {(() => { const I = DISCOUNT_ICONS[form.discountType] || Tag; return <I className="w-6 h-6 text-[#DC2626]" />; })()}
                  </div>
                  <div>
                    <div className="font-mono font-bold text-lg text-gray-900 dark:text-white">{form.code || "—"}</div>
                    <p className="text-sm text-gray-500">{form.label || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Type:</span>{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{DISCOUNT_LABELS[form.discountType]}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Valeur:</span>{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {form.discountType === "PERCENT" ? `${form.valuePercent}%` :
                        form.discountType === "FIXED" ? `${(form.valueCents / 100).toFixed(2)}€` :
                          "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Portée:</span>{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{form.scope === "PLATFORM" ? "Plateforme" : "Boutique"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Financé par:</span>{" "}
                    <span className={`font-semibold ${form.payer === "KLIKGO" ? "text-blue-600" : "text-orange-600"}`}>
                      {form.payer === "KLIKGO" ? "Klik&Go" : "Boucher"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Durée:</span>{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{form.durationDays} jours</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Limite:</span>{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{form.maxUses || "Illimité"}</span>
                  </div>
                </div>

                {/* Diffusion summary */}
                <div className="border-t border-[#ece8e3] dark:border-white/10 pt-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Diffusion</div>
                  <div className="flex flex-wrap gap-2">
                    {form.diffBadge && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <BadgePercent className="w-3.5 h-3.5 text-[#DC2626]" /> Badge
                      </span>
                    )}
                    {form.diffBanner && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <LayoutDashboard className="w-3.5 h-3.5 text-amber-600" /> Bannière
                      </span>
                    )}
                    {form.diffPopup && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Eye className="w-3.5 h-3.5 text-blue-600" /> Popup
                      </span>
                    )}
                    {!form.diffBadge && !form.diffBanner && !form.diffPopup && (
                      <span className="text-xs text-gray-400">Aucun canal de diffusion sélectionné</span>
                    )}
                  </div>
                </div>

                {form.isFlash && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold">
                    <Zap className="w-4 h-4" /> Offre flash
                  </div>
                )}
              </div>

              {/* Preview diffusion */}
              {form.diffBanner && form.bannerTitle && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Aperçu bannière</div>
                  <BannerPreview title={form.bannerTitle} subtitle={form.bannerSubtitle} color={form.bannerColor} code={form.code || "CODE"} />
                </div>
              )}
              {form.diffPopup && form.popupTitle && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Aperçu popup</div>
                  <PopupPreview title={form.popupTitle} message={form.popupMessage} color={form.popupColor} code={form.code || "CODE"} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-[#141414] border-t border-[#ece8e3] dark:border-white/10 p-4 flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm">
              Retour
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm">
            Annuler
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition"
            >
              Suivant
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 bg-[#DC2626] text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition disabled:opacity-50"
            >
              {saving ? "Création..." : "Créer l'offre"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// CREATE CAMPAIGN MODAL
// ══════════════════════════════════════════

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvelle campagne</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Segment</label>
            <select
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
            >
              <option value="ALL">Tous les clients</option>
              <option value="LOYAL">Clients fidèles</option>
              <option value="INACTIVE">Clients inactifs</option>
              <option value="NEW">Nouveaux clients</option>
              <option value="BUTCHERS">Bouchers</option>
            </select>
          </div>
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

// ══════════════════════════════════════════
// PROPOSE MODAL — Propose offer to butchers
// ══════════════════════════════════════════

function ProposeModal({
  codeId,
  shops,
  onClose,
  onDone,
}: {
  codeId: string;
  shops: ShopData[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = shops.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleShop = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };

  const handlePropose = async () => {
    if (selected.size === 0) { toast.error("Sélectionnez au moins 1 boutique"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/webmaster/promo-codes/${codeId}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Offre proposée à ${json.data.proposed} boucher(s)`);
        onDone();
      } else {
        toast.error(json.error?.message || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-md border border-[#ece8e3] dark:border-white/10 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#ece8e3] dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Proposer aux bouchers
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une boutique..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#ece8e3] dark:border-white/10 rounded-lg bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={toggleAll}
            className="text-xs font-semibold text-[#DC2626] mb-3 hover:underline"
          >
            {selected.size === filtered.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <div className="space-y-1.5">
            {filtered.map((shop) => (
              <label
                key={shop.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                  selected.has(shop.id)
                    ? "bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800"
                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(shop.id)}
                  onChange={() => toggleShop(shop.id)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600"
                />
                <Store className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{shop.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucune boutique trouvée</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#ece8e3] dark:border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm">
            Annuler
          </button>
          <button
            onClick={handlePropose}
            disabled={saving || selected.size === 0}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? "Envoi..." : `Proposer (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
