// src/app/(boucher)/boucher/dashboard/promos/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Plus,
  Zap,
  Tag,
  Percent,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  Users,
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
  targetProductIds: string[];
  minOrderCents: number | null;
  maxUses: number | null;
  maxUsesPerUser: number;
  currentUses: number;
  code: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isFlash: boolean;
  flashDurationHours: number | null;
  proposalStatus: string | null;
  proposalNote: string | null;
  createdAt: string;
};

type FormData = {
  label: string;
  type: "PERCENT" | "FIXED" | "FREE_FEES";
  valuePercent: string;
  valueCents: string;
  target: "ALL" | "LOYAL" | "INACTIVE" | "SPECIFIC_PRODUCTS";
  minOrderCents: string;
  maxUses: string;
  maxUsesPerUser: string;
  startsAt: string;
  endsAt: string;
  code: string;
  isFlash: boolean;
  flashDurationHours: string;
};

const EMPTY_FORM: FormData = {
  label: "",
  type: "PERCENT",
  valuePercent: "10",
  valueCents: "500",
  target: "ALL",
  minOrderCents: "",
  maxUses: "",
  maxUsesPerUser: "1",
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  code: "",
  isFlash: false,
  flashDurationHours: "2",
};

function formatEuro(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function promoValueLabel(p: Promotion) {
  if (p.type === "PERCENT") return `-${p.valuePercent}%`;
  if (p.type === "FIXED") return `-${formatEuro(p.valueCents || 0)}`;
  return "Frais offerts";
}

function targetLabel(t: string) {
  switch (t) {
    case "ALL": return "Tous les clients";
    case "LOYAL": return "Clients fidèles";
    case "INACTIVE": return "Clients inactifs";
    case "SPECIFIC_PRODUCTS": return "Produits ciblés";
    default: return t;
  }
}

export default function BoucherPromosPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [proposals, setProposals] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/promotions");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPromos(json.data?.promotions || []);
      setProposals(json.data?.proposals || []);
    } catch {
      toast.error("Erreur de chargement des promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        label: form.label,
        type: form.type,
        target: form.target,
        maxUsesPerUser: parseInt(form.maxUsesPerUser) || 1,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        isFlash: form.isFlash,
      };
      if (form.type === "PERCENT") body.valuePercent = parseFloat(form.valuePercent);
      if (form.type === "FIXED") body.valueCents = parseInt(form.valueCents);
      if (form.minOrderCents) body.minOrderCents = parseInt(form.minOrderCents);
      if (form.maxUses) body.maxUses = parseInt(form.maxUses);
      if (form.code.trim()) body.code = form.code.trim();
      if (form.isFlash && form.flashDurationHours) body.flashDurationHours = parseInt(form.flashDurationHours);

      const res = await fetch("/api/boucher/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Erreur lors de la création");
        return;
      }
      toast.success(form.isFlash ? "Offre flash créée !" : "Promotion créée !");
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      fetchPromos();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (promoId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/boucher/promotions/${promoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(isActive ? "Promo activée" : "Promo désactivée");
      fetchPromos();
    } catch {
      toast.error("Erreur");
    }
  };

  const deletePromo = async (promoId: string) => {
    try {
      const res = await fetch(`/api/boucher/promotions/${promoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Promotion supprimée");
      fetchPromos();
    } catch {
      toast.error("Erreur");
    }
  };

  const handleProposal = async (promoId: string, action: "accept" | "reject") => {
    try {
      const res = await fetch(`/api/boucher/promotions/${promoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === "accept" ? "Proposition acceptée" : "Proposition refusée");
      fetchPromos();
    } catch {
      toast.error("Erreur");
    }
  };

  const activePromos = promos.filter((p) => p.isActive && new Date(p.endsAt) > new Date());
  const inactivePromos = promos.filter((p) => !p.isActive || new Date(p.endsAt) <= new Date());
  const pendingProposals = proposals.filter((p) => p.proposalStatus === "PROPOSED");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/boucher/dashboard" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Mes promotions</h1>
            <p className="text-sm text-gray-500">{activePromos.length} promo{activePromos.length > 1 ? "s" : ""} active{activePromos.length > 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Plus size={16} /> Nouvelle promo
          </Button>
        </div>

        {/* Proposals from webmaster */}
        {pendingProposals.length > 0 && (
          <div className="mb-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" />
              Propositions Klik&Go ({pendingProposals.length})
            </h2>
            {pendingProposals.map((p) => (
              <Card key={p.id} className="border-amber-300 dark:border-amber-600/30 bg-amber-50/50 dark:bg-amber-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold">{p.label}</p>
                      <p className="text-sm text-gray-500">
                        {promoValueLabel(p)} &middot; {targetLabel(p.target)}
                        {p.proposalNote && <> &middot; {p.proposalNote}</>}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleProposal(p.id, "reject")}>
                        Refuser
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleProposal(p.id, "accept")}>
                        Accepter
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create promo form */}
        {showForm && (
          <Card className="mb-6 border-red-200 dark:border-red-900/30">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Tag size={18} className="text-red-600" />
                {form.isFlash ? "Nouvelle offre flash" : "Nouvelle promotion"}
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Flash toggle */}
                <div className="flex items-center gap-3">
                  <Switch checked={form.isFlash} onCheckedChange={(v) => setForm({ ...form, isFlash: v })} />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" /> Offre flash (push aux clients)
                  </span>
                </div>

                {/* Label */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom de la promo</label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Ex: Spécial Barbecue"
                    className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type de réduction</label>
                  <div className="flex gap-2 mt-1">
                    {(["PERCENT", "FIXED", "FREE_FEES"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, type: t })}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          form.type === t
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {t === "PERCENT" ? "% Réduction" : t === "FIXED" ? "Montant fixe" : "Frais offerts"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value */}
                {form.type === "PERCENT" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pourcentage</label>
                    <div className="flex items-center gap-2 mt-1">
                      {["5", "10", "15", "20"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setForm({ ...form, valuePercent: v })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium ${
                            form.valuePercent === v
                              ? "bg-red-600 text-white"
                              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          -{v}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {form.type === "FIXED" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant (en centimes)</label>
                    <input
                      type="number"
                      value={form.valueCents}
                      onChange={(e) => setForm({ ...form, valueCents: e.target.value })}
                      min="100"
                      step="100"
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                    />
                    <p className="text-xs text-gray-400 mt-1">500 = 5,00 \u20AC</p>
                  </div>
                )}

                {/* Ciblage */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ciblage</label>
                  <select
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value as FormData["target"] })}
                    className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                  >
                    <option value="ALL">Tous les clients</option>
                    <option value="LOYAL">Clients fidèles (5+ commandes)</option>
                    <option value="INACTIVE">Clients inactifs (30j+)</option>
                  </select>
                </div>

                {/* Code promo */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code promo (optionnel)</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: BARBECUE2026"
                    className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10 uppercase"
                  />
                  <p className="text-xs text-gray-400 mt-1">Laissez vide pour auto-appliquer sans code</p>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Début</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fin</label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                      required
                    />
                  </div>
                </div>

                {/* Flash duration */}
                {form.isFlash && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durée de l&apos;offre flash</label>
                    <div className="flex gap-2 mt-1">
                      {["1", "2", "3"].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setForm({ ...form, flashDurationHours: h })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium ${
                            form.flashDurationHours === h
                              ? "bg-amber-500 text-white"
                              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max utilisations total</label>
                    <input
                      type="number"
                      value={form.maxUses}
                      onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                      placeholder="Illimité"
                      min="1"
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max par client</label>
                    <input
                      type="number"
                      value={form.maxUsesPerUser}
                      onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value })}
                      min="1"
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-white/5 dark:border-white/10"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating || !form.label}
                    className={`flex-1 text-white ${form.isFlash ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"}`}
                  >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : form.isFlash ? "Lancer l'offre flash" : "Créer la promo"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Active promos */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Tag size={18} className="text-green-600" />
            Promos actives ({activePromos.length})
          </h2>
          {activePromos.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-gray-400">Aucune promotion active</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {activePromos.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold truncate">{p.label}</p>
                          <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {promoValueLabel(p)}
                          </Badge>
                          {p.isFlash && (
                            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <Zap size={10} className="mr-0.5" /> Flash
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Users size={12} /> {targetLabel(p.target)}</span>
                          <span className="flex items-center gap-1"><Eye size={12} /> {p.currentUses}{p.maxUses ? `/${p.maxUses}` : ""} utilisations</span>
                          <span className="flex items-center gap-1"><Calendar size={12} /> jusqu&apos;au {new Date(p.endsAt).toLocaleDateString("fr-FR")}</span>
                        </p>
                        {p.code && <p className="text-xs font-mono text-red-600 mt-1">Code : {p.code}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={p.isActive} onCheckedChange={(v) => toggleActive(p.id, v)} />
                        <button onClick={() => deletePromo(p.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past/inactive promos */}
        {inactivePromos.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Percent size={18} className="text-gray-400" />
              Historique ({inactivePromos.length})
            </h2>
            <div className="space-y-2">
              {inactivePromos.map((p) => (
                <Card key={p.id} className="opacity-60">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">{p.label}</p>
                        <p className="text-xs text-gray-400">
                          {promoValueLabel(p)} &middot; {p.currentUses} utilisations &middot; Fin {new Date(p.endsAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <button onClick={() => deletePromo(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
