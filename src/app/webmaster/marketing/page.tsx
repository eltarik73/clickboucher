// /webmaster/marketing — Platform promotions + marketing overview
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Megaphone,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Tag,
  Calendar,
  Store,
  Users,
  Zap,
  Send,
  Mail,
  Loader2,
  Sparkles,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

type Promotion = {
  id: string;
  source: string;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  label: string;
  description: string | null;
  target: string;
  code: string | null;
  maxUses: number | null;
  currentUses: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isFlash: boolean;
  shop: { name: string; slug: string } | null;
  createdAt: string;
};

type Campaign = {
  id: string;
  type: string;
  subject: string;
  htmlContent: string;
  segment: string;
  status: string;
  sentCount: number;
  openCount: number;
  sentAt: string | null;
  createdAt: string;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtValue(p: Promotion) {
  if (p.type === "PERCENT") return `-${p.valuePercent}%`;
  if (p.type === "FIXED") return `-${((p.valueCents || 0) / 100).toFixed(0)}€`;
  return "Frais offerts";
}

export default function MarketingPage() {
  const [tab, setTab] = useState<"promos" | "campaigns">("promos");
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [filter, setFilter] = useState<"all" | "platform" | "shop">("all");

  // Loyalty stats
  const [loyaltyStats, setLoyaltyStats] = useState<{
    totalRewards: number; usedRewards: number; activeRewards: number; fideleCount: number; totalDiscountCents: number;
  } | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const [promosRes, campaignsRes, loyaltyRes] = await Promise.all([
        fetch("/api/webmaster/promotions"),
        fetch("/api/webmaster/campaigns"),
        fetch("/api/webmaster/loyalty"),
      ]);
      if (promosRes.ok) {
        const json = await promosRes.json();
        setPromos(json.data?.promotions || []);
      }
      if (campaignsRes.ok) {
        const json = await campaignsRes.json();
        setCampaigns(json.data?.campaigns || []);
      }
      if (loyaltyRes.ok) {
        const json = await loyaltyRes.json();
        setLoyaltyStats(json.data?.stats || null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const filtered = promos.filter((p) => {
    if (filter === "platform") return p.source === "PLATFORM";
    if (filter === "shop") return p.source === "SHOP";
    return true;
  });

  const activeCount = promos.filter((p) => p.isActive && new Date(p.endsAt) > new Date()).length;
  const platformCount = promos.filter((p) => p.source === "PLATFORM").length;
  const shopCount = promos.filter((p) => p.source === "SHOP").length;

  async function togglePromo(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/webmaster/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) { fetch_(); toast.success(isActive ? "Désactivée" : "Activée"); }
    } catch { toast.error("Erreur"); }
  }

  async function deletePromo(id: string) {
    if (!confirm("Supprimer cette promotion ?")) return;
    try {
      const res = await fetch(`/api/webmaster/promotions/${id}`, { method: "DELETE" });
      if (res.ok) { fetch_(); toast.success("Supprimée"); }
    } catch { toast.error("Erreur"); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone size={22} />
            Marketing & Promos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Promotions, campagnes IA et communications
          </p>
        </div>
        {tab === "promos" ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#b91c1c] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Plus size={16} />
            Promo Klik&Go
          </button>
        ) : (
          <button
            onClick={() => setShowCreateCampaign(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#b91c1c] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Sparkles size={16} />
            Campagne IA
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-5 w-fit">
        <button
          onClick={() => setTab("promos")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            tab === "promos"
              ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500"
          }`}
        >
          <Tag size={14} /> Promotions
        </button>
        <button
          onClick={() => setTab("campaigns")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            tab === "campaigns"
              ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500"
          }`}
        >
          <Mail size={14} /> Campagnes
          {campaigns.filter((c) => c.status === "DRAFT").length > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full px-1">
              {campaigns.filter((c) => c.status === "DRAFT").length}
            </span>
          )}
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Promos actives</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{platformCount} Klik&Go / {shopCount} bouchers</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Campagnes</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{campaigns.filter((c) => c.status === "SENT").length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{campaigns.reduce((s, c) => s + c.sentCount, 0)} emails envoyes</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Fidelite</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{loyaltyStats?.fideleCount || 0}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{loyaltyStats?.activeRewards || 0} bons actifs</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Utilisations</p>
          <p className="text-2xl font-bold text-primary mt-1">{promos.reduce((s, p) => s + p.currentUses, 0)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {loyaltyStats?.totalDiscountCents ? `${(loyaltyStats.totalDiscountCents / 100).toFixed(0)}€ fidelite` : "0€ fidelite"}
          </p>
        </div>
      </div>

      {/* ═══════ PROMOTIONS TAB ═══════ */}
      {tab === "promos" && <>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-5 w-fit">
        {[
          { key: "all" as const, label: "Toutes" },
          { key: "platform" as const, label: "Klik&Go" },
          { key: "shop" as const, label: "Bouchers" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-10 text-center">
          <Megaphone size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">Aucune promotion trouvée</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((promo) => {
            const expired = new Date(promo.endsAt) <= new Date();
            return (
              <div
                key={promo.id}
                className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {promo.source === "PLATFORM" ? (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Megaphone size={14} className="text-primary" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                        {promo.isFlash ? <Zap size={14} className="text-amber-500" /> : <Store size={14} className="text-amber-600" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {promo.label}
                        </span>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {fmtValue(promo)}
                        </span>
                        {promo.code && (
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                            {promo.code}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          promo.source === "PLATFORM"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {promo.source === "PLATFORM" ? "Klik&Go paie" : "Boucher paie"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {promo.shop && <span className="flex items-center gap-1"><Store size={10} />{promo.shop.name}</span>}
                        <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(promo.startsAt)} — {fmtDate(promo.endsAt)}</span>
                        <span className="flex items-center gap-1"><Tag size={10} />{promo.currentUses}{promo.maxUses ? `/${promo.maxUses}` : ""}</span>
                        <span className="flex items-center gap-1"><Users size={10} />{promo.target}</span>
                        {expired && <span className="text-red-400 font-semibold">Expirée</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => togglePromo(promo.id, promo.isActive)}>
                      {promo.isActive && !expired ? (
                        <ToggleRight size={28} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={28} className="text-gray-400" />
                      )}
                    </button>
                    <button onClick={() => deletePromo(promo.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>}

      {/* ═══════ CAMPAIGNS TAB ═══════ */}
      {tab === "campaigns" && (
        <div>
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && campaigns.length === 0 && (
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-10 text-center">
              <Mail size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">Aucune campagne email</p>
              <p className="text-xs text-gray-400 mt-1">Créez votre première campagne avec l&apos;IA</p>
            </div>
          )}

          {!loading && campaigns.length > 0 && (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} onRefresh={fetch_} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create platform promo dialog */}
      {showCreate && (
        <CreatePlatformPromoDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetch_(); }}
        />
      )}

      {showCreateCampaign && (
        <CreateCampaignDialog
          onClose={() => setShowCreateCampaign(false)}
          onCreated={() => { setShowCreateCampaign(false); fetch_(); }}
        />
      )}
    </div>
  );
}

function CreatePlatformPromoDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED" | "FREE_FEES">("FIXED");
  const [valueCents, setValueCents] = useState(500);
  const [valuePercent, setValuePercent] = useState(10);
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<"ALL" | "LOYAL" | "INACTIVE">("ALL");
  const [daysValid, setDaysValid] = useState(30);
  const [maxUses, setMaxUses] = useState<number | "">(500);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);

    const now = new Date();
    const endsAt = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

    try {
      const res = await fetch("/api/webmaster/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          valueCents: type === "FIXED" ? valueCents : undefined,
          valuePercent: type === "PERCENT" ? valuePercent : undefined,
          label: label.trim(),
          target,
          maxUses: maxUses || undefined,
          maxUsesPerUser: 1,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          code: code.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Promotion plateforme créée !");
        onCreated();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Megaphone size={20} className="text-primary" />
          Nouvelle promo Klik&Go
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Bon de 5€ Klik&Go" className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white" required />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white">
              <option value="FIXED">Montant fixe (€)</option>
              <option value="PERCENT">Pourcentage (%)</option>
              <option value="FREE_FEES">Frais offerts</option>
            </select>
          </div>

          {type === "FIXED" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant (€)</label>
              <input type="number" value={valueCents / 100} onChange={(e) => setValueCents(Math.round(parseFloat(e.target.value) * 100) || 0)} min={0.5} step={0.5} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white" />
            </div>
          )}

          {type === "PERCENT" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pourcentage</label>
              <input type="number" value={valuePercent} onChange={(e) => setValuePercent(parseInt(e.target.value) || 0)} min={1} max={100} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Code promo (optionnel)</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: RAMADAN2026" className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white font-mono" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciblage</label>
            <select value={target} onChange={(e) => setTarget(e.target.value as typeof target)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white">
              <option value="ALL">Tous les clients</option>
              <option value="LOYAL">Clients fidèles (5+ commandes)</option>
              <option value="INACTIVE">Clients inactifs (30j+)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Durée (jours)</label>
              <input type="number" value={daysValid} onChange={(e) => setDaysValid(parseInt(e.target.value) || 1)} min={1} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Max utilisations</label>
              <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : "")} placeholder="Illimité" min={1} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Klik&Go paie cette promotion. Le boucher reçoit sa part sur le prix plein. La réduction est une charge marketing Klik&Go.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300">Annuler</button>
            <button type="submit" disabled={saving || !label.trim()} className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-[#b91c1c] text-white text-sm font-bold transition-colors disabled:opacity-50">
              {saving ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Campaign Row ──
function CampaignRow({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const segmentLabel: Record<string, string> = {
    ALL: "Tous",
    LOYAL: "Fideles",
    INACTIVE: "Inactifs",
    BUTCHERS: "Bouchers",
  };

  async function sendCampaign() {
    if (!confirm(`Envoyer cette campagne a ${campaign.segment === "ALL" ? "tous les clients" : segmentLabel[campaign.segment] || campaign.segment} ?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/webmaster/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`Campagne envoyee a ${json.data?.sentResult?.sentCount || 0} destinataires`);
        onRefresh();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur d'envoi");
      }
    } catch { toast.error("Erreur"); }
    finally { setSending(false); }
  }

  async function deleteCampaign() {
    if (!confirm("Supprimer cette campagne ?")) return;
    try {
      await fetch(`/api/webmaster/campaigns/${campaign.id}`, { method: "DELETE" });
      onRefresh();
    } catch { toast.error("Erreur"); }
  }

  return (
    <>
      <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              campaign.status === "SENT" ? "bg-emerald-100 dark:bg-emerald-500/10" : "bg-purple-100 dark:bg-purple-500/10"
            }`}>
              {campaign.status === "SENT" ? <Send size={14} className="text-emerald-600" /> : <Sparkles size={14} className="text-purple-600" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{campaign.subject}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  campaign.status === "SENT"
                    ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600"
                    : "bg-purple-100 dark:bg-purple-500/10 text-purple-600"
                }`}>
                  {campaign.status === "SENT" ? "Envoyee" : "Brouillon"}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                  {segmentLabel[campaign.segment] || campaign.segment}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                {campaign.sentAt && <span>Envoyee le {fmtDate(campaign.sentAt)}</span>}
                {campaign.sentCount > 0 && <span className="flex items-center gap-1"><Send size={10} />{campaign.sentCount} envois</span>}
                {campaign.openCount > 0 && <span className="flex items-center gap-1"><Eye size={10} />{campaign.openCount} ouvertures</span>}
                {!campaign.sentAt && <span>Creee le {fmtDate(campaign.createdAt)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowPreview(true)} className="text-gray-400 hover:text-gray-600 p-1" title="Aperçu">
              <Eye size={16} />
            </button>
            {campaign.status === "DRAFT" && (
              <button
                onClick={sendCampaign}
                disabled={sending}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-[#b91c1c] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Envoyer
              </button>
            )}
            <button onClick={deleteCampaign} className="text-gray-400 hover:text-red-500 p-1">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Aperçu : {campaign.subject}</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: campaign.htmlContent }} />
          </div>
        </div>
      )}
    </>
  );
}

// ── Create Campaign Dialog ──
function CreateCampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("NEWSLETTER_CLIENT");
  const [segment, setSegment] = useState("ALL");
  const [objective, setObjective] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("amical et professionnel");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/webmaster/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          segment,
          objective: objective.trim(),
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          tone: tone.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Campagne generee par IA !");
        onCreated();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur de generation");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-purple-500" />
          Nouvelle campagne IA
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white">
              <option value="NEWSLETTER_CLIENT">Newsletter client</option>
              <option value="SPECIAL_OFFER">Offre spéciale</option>
              <option value="EMAIL_BUTCHER">Email aux bouchers</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Audience</label>
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white">
              <option value="ALL">Tous les clients</option>
              <option value="LOYAL">Clients fideles (3+ commandes)</option>
              <option value="INACTIVE">Clients inactifs (30j+)</option>
              <option value="BUTCHERS">Bouchers partenaires</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Objectif de la campagne</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: Ramener les clients inactifs avec un bon de 5€, promouvoir les nouvelles boucheries..."
              rows={3}
              maxLength={500}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white resize-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mots-clés (optionnel)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ramadan, eid, merguez, barbecue..."
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
            />
            <p className="text-[10px] text-gray-400 mt-1">Séparez par des virgules</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ton</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white">
              <option value="amical et professionnel">Amical & professionnel</option>
              <option value="chaleureux et familial">Chaleureux & familial</option>
              <option value="urgent et promotionnel">Urgent & promotionnel</option>
              <option value="informatif et sobre">Informatif & sobre</option>
            </select>
          </div>

          <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-3">
            <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
              <Sparkles size={12} />
              L&apos;IA va générer le sujet et le contenu HTML de l&apos;email. Vous pourrez relire avant d&apos;envoyer.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300">Annuler</button>
            <button type="submit" disabled={saving || !objective.trim()} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Génération IA...</> : <><Sparkles size={14} /> Générer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
