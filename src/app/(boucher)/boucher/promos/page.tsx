// /boucher/promos — Boucher promotions management
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Percent,
  Plus,
  Zap,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Calendar,
  Tag,
  Megaphone,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

type Promotion = {
  id: string;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  label: string;
  description: string | null;
  target: string;
  maxUses: number | null;
  currentUses: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isFlash: boolean;
  flashDurationHours: number | null;
  code: string | null;
  createdAt: string;
};

type Proposal = Promotion & {
  proposalStatus: string; // PROPOSED | ACCEPTED | REJECTED
  proposalNote: string | null;
  rejectedReason: string | null;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatPromoValue(promo: Promotion) {
  if (promo.type === "PERCENT") return `-${promo.valuePercent}%`;
  if (promo.type === "FIXED") return `-${((promo.valueCents || 0) / 100).toFixed(0)}€`;
  if (promo.type === "FREE_FEES") return "Frais offerts";
  return promo.type;
}

export default function BoucherPromosPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/promotions");
      if (res.ok) {
        const json = await res.json();
        setPromos(json.data?.promotions || []);
        setProposals(json.data?.proposals || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  async function togglePromo(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/boucher/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        fetchPromos();
        toast.success(isActive ? "Promo désactivée" : "Promo activée");
      }
    } catch {
      toast.error("Erreur");
    }
  }

  async function deletePromo(id: string) {
    if (!confirm("Supprimer cette promotion ?")) return;
    try {
      const res = await fetch(`/api/boucher/promotions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPromos();
        toast.success("Promotion supprimée");
      }
    } catch {
      toast.error("Erreur");
    }
  }

  const activePromos = promos.filter((p) => p.isActive && new Date(p.endsAt) > new Date());
  const pastPromos = promos.filter((p) => !p.isActive || new Date(p.endsAt) <= new Date());

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Percent size={22} />
            Mes promotions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Créez des offres pour vos clients. La réduction est déduite de votre reversement.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFlash(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Zap size={16} />
            Offre flash
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#b91c1c] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Plus size={16} />
            Nouvelle promo
          </button>
        </div>
      </div>

      {/* Proposals from webmaster */}
      {proposals.filter((p) => p.proposalStatus === "PROPOSED").length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
            <Megaphone size={16} />
            Propositions Klik&Go
            <span className="min-w-[20px] h-5 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5">
              {proposals.filter((p) => p.proposalStatus === "PROPOSED").length}
            </span>
          </h2>
          <div className="space-y-2">
            {proposals
              .filter((p) => p.proposalStatus === "PROPOSED")
              .map((p) => (
                <ProposalCard key={p.id} proposal={p} onAction={fetchPromos} />
              ))}
          </div>
        </div>
      )}

      {/* Accepted/rejected proposals history */}
      {proposals.filter((p) => p.proposalStatus !== "PROPOSED").length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Propositions traitees ({proposals.filter((p) => p.proposalStatus !== "PROPOSED").length})
          </h2>
          <div className="space-y-2 opacity-60">
            {proposals
              .filter((p) => p.proposalStatus !== "PROPOSED")
              .map((p) => (
                <ProposalCard key={p.id} proposal={p} onAction={fetchPromos} />
              ))}
          </div>
        </div>
      )}

      {/* Active promos */}
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Mes promos actives ({activePromos.length})
      </h2>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && activePromos.length === 0 && (
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-8 text-center mb-6">
          <Percent size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">Aucune promotion active</p>
        </div>
      )}

      {!loading && activePromos.length > 0 && (
        <div className="space-y-2 mb-6">
          {activePromos.map((promo) => (
            <PromoCard
              key={promo.id}
              promo={promo}
              onToggle={() => togglePromo(promo.id, promo.isActive)}
              onDelete={() => deletePromo(promo.id)}
            />
          ))}
        </div>
      )}

      {/* Past promos */}
      {pastPromos.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 mt-8">
            Historique ({pastPromos.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {pastPromos.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                onToggle={() => togglePromo(promo.id, promo.isActive)}
                onDelete={() => deletePromo(promo.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create promo dialog */}
      {showCreate && (
        <CreatePromoDialog
          isFlash={false}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchPromos();
          }}
        />
      )}

      {/* Flash offer dialog */}
      {showFlash && (
        <CreatePromoDialog
          isFlash={true}
          onClose={() => setShowFlash(false)}
          onCreated={() => {
            setShowFlash(false);
            fetchPromos();
          }}
        />
      )}
    </div>
  );
}

function PromoCard({
  promo,
  onToggle,
  onDelete,
}: {
  promo: Promotion;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const expired = new Date(promo.endsAt) <= new Date();

  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {promo.isFlash && <Zap size={16} className="text-amber-500 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {promo.label}
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                {formatPromoValue(promo)}
              </span>
              {promo.code && (
                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                  {promo.code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(promo.startsAt)} — {formatDate(promo.endsAt)}
              </span>
              <span className="flex items-center gap-1">
                <Tag size={10} />
                {promo.currentUses}{promo.maxUses ? `/${promo.maxUses}` : ""} utilisations
              </span>
              {expired && (
                <span className="text-red-400 font-semibold">Expirée</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggle} className="p-1">
            {promo.isActive && !expired ? (
              <ToggleRight size={28} className="text-emerald-500" />
            ) : (
              <ToggleLeft size={28} className="text-gray-400" />
            )}
          </button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePromoDialog({
  isFlash,
  onClose,
  onCreated,
}: {
  isFlash: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(isFlash ? "" : "");
  const [type, setType] = useState<"PERCENT" | "FIXED" | "FREE_FEES">("PERCENT");
  const [valuePercent, setValuePercent] = useState(10);
  const [valueCents, setValueCents] = useState(500);
  const [flashHours, setFlashHours] = useState(2);
  const [daysValid, setDaysValid] = useState(7);
  const [maxUses, setMaxUses] = useState<number | "">(100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    setSaving(true);
    const now = new Date();
    const endsAt = isFlash
      ? new Date(now.getTime() + flashHours * 60 * 60 * 1000)
      : new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

    try {
      const res = await fetch("/api/boucher/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          valueCents: type === "FIXED" ? valueCents : undefined,
          valuePercent: type === "PERCENT" ? valuePercent : undefined,
          label: label.trim(),
          target: "ALL",
          maxUses: maxUses || undefined,
          maxUsesPerUser: 1,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          isFlash,
          flashDurationHours: isFlash ? flashHours : undefined,
        }),
      });

      if (res.ok) {
        toast.success(isFlash ? "Offre flash créée !" : "Promotion créée !");
        onCreated();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || "Erreur lors de la création");
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
        className="relative bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          {isFlash ? <Zap size={20} className="text-amber-500" /> : <Plus size={20} />}
          {isFlash ? "Nouvelle offre flash" : "Nouvelle promotion"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Nom de l&apos;offre
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isFlash ? "Ex: Merguez -20% !" : "Ex: Spécial Barbecue"}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Type de réduction
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED" | "FREE_FEES")}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
            >
              <option value="PERCENT">Pourcentage (%)</option>
              <option value="FIXED">Montant fixe (€)</option>
              <option value="FREE_FEES">Frais offerts</option>
            </select>
          </div>

          {type === "PERCENT" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Réduction (%)
              </label>
              <div className="flex gap-2 mt-1">
                {[5, 10, 15, 20].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setValuePercent(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      valuePercent === v
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    -{v}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "FIXED" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Montant (€)
              </label>
              <input
                type="number"
                value={valueCents / 100}
                onChange={(e) => setValueCents(Math.round(parseFloat(e.target.value) * 100) || 0)}
                min={0.5}
                step={0.5}
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
              />
            </div>
          )}

          {isFlash ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Durée de l&apos;offre
              </label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setFlashHours(h)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      flashHours === h
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Durée (jours)
              </label>
              <div className="flex gap-2 mt-1">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysValid(d)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      daysValid === d
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {d}j
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Limite d&apos;utilisations (optionnel)
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="Illimité"
              min={1}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              La réduction est déduite de votre reversement. Le montant que Klik&Go vous reverse sera réduit du montant de la promotion.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-[#b91c1c] text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              {saving ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Proposal Card (accept / reject) ──
function ProposalCard({ proposal, onAction }: { proposal: Proposal; onAction: () => void }) {
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isPending = proposal.proposalStatus === "PROPOSED";

  async function handleAction(action: "accept" | "reject") {
    setActing(true);
    try {
      const res = await fetch(`/api/boucher/promotions/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" && rejectReason ? { rejectedReason: rejectReason } : {}),
        }),
      });
      if (res.ok) {
        toast.success(action === "accept" ? "Promotion acceptee !" : "Proposition refusee");
        onAction();
      } else {
        toast.error("Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setActing(false);
      setShowReject(false);
    }
  }

  return (
    <div className={`bg-white dark:bg-[#141414] rounded-xl border px-4 py-3 ${
      isPending
        ? "border-amber-300 dark:border-amber-500/30 ring-1 ring-amber-200/50 dark:ring-amber-500/20"
        : "border-gray-200 dark:border-white/10"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Megaphone size={14} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                {proposal.label}
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {formatPromoValue(proposal)}
              </span>
              {proposal.proposalStatus === "PROPOSED" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-600">
                  En attente
                </span>
              )}
              {proposal.proposalStatus === "ACCEPTED" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600">
                  Acceptee
                </span>
              )}
              {proposal.proposalStatus === "REJECTED" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/10 text-red-600">
                  Refusee
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(proposal.startsAt)} — {formatDate(proposal.endsAt)}
              </span>
              {proposal.code && (
                <span className="font-mono text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                  {proposal.code}
                </span>
              )}
            </div>

            {proposal.proposalNote && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg px-2.5 py-1.5">
                <MessageSquare size={12} className="shrink-0 mt-0.5" />
                <span>{proposal.proposalNote}</span>
              </div>
            )}

            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
              Vous payez cette promotion (deduite de votre reversement)
            </p>
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleAction("accept")}
              disabled={acting}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              <Check size={14} />
              Accepter
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={acting}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-600 dark:text-gray-300 hover:text-red-600 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Refuser
            </button>
          </div>
        )}
      </div>

      {/* Reject reason input */}
      {showReject && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Raison du refus (optionnel)"
            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReject(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Annuler
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={acting}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
