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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtValue(p: Promotion) {
  if (p.type === "PERCENT") return `-${p.valuePercent}%`;
  if (p.type === "FIXED") return `-${((p.valueCents || 0) / 100).toFixed(0)}€`;
  return "Frais offerts";
}

export default function MarketingPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "platform" | "shop">("all");

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/webmaster/promotions");
      if (res.ok) {
        const json = await res.json();
        setPromos(json.data?.promotions || []);
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
            Gérez les promotions plateforme et suivez les promos bouchers
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#b91c1c] text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          Promo Klik&Go
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-xs text-gray-500">Actives</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-xs text-gray-500">Klik&Go</p>
          <p className="text-2xl font-bold text-primary">{platformCount}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 p-4">
          <p className="text-xs text-gray-500">Bouchers</p>
          <p className="text-2xl font-bold text-amber-500">{shopCount}</p>
        </div>
      </div>

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

      {/* Create platform promo dialog */}
      {showCreate && (
        <CreatePlatformPromoDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetch_(); }}
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
