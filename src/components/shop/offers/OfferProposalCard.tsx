"use client";

import { useState } from "react";
import {
  Gift,
  Crown,
  Calendar,
  Tag,
  ShoppingCart,
  CheckCircle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
type ProposalOffer = {
  id: string;
  name: string;
  code: string;
  type: string;
  discountValue: number;
  payer: string;
  startDate: string;
  endDate: string;
  minOrder: number;
  audience: string;
  diffBadge: boolean;
  diffBanner: boolean;
  diffPopup: boolean;
};

type Proposal = {
  id: string;
  offerId: string;
  status: string;
  respondedAt: string | null;
  createdAt: string;
  offer: ProposalOffer;
};

type Props = {
  proposal: Proposal;
  onRespond: (accepted: boolean) => void;
};

// ── Helpers ────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  PERCENT: "Réduction %",
  AMOUNT: "Montant fixe",
  FREE_DELIVERY: "Frais offerts",
  BOGO: "1+1 Offert",
  BUNDLE: "Pack promo",
};

const PAYER_LABELS: Record<string, string> = {
  KLIKGO: "Klik&Go",
  BUTCHER: "Boucher",
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Tous les clients",
  NEW: "Nouveaux clients",
  LOYAL: "Clients fidèles",
  VIP: "Clients VIP",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDiscount(type: string, value: number): string {
  if (type === "PERCENT") return `-${value}%`;
  if (type === "AMOUNT") return `-${value.toFixed(2).replace(".", ",")} \u20AC`;
  if (type === "FREE_DELIVERY") return "Frais offerts";
  if (type === "BOGO") return "1 acheté = 1 offert";
  if (type === "BUNDLE") return `Pack -${value}%`;
  return String(value);
}

// ── Component ──────────────────────────────────────────────
export default function OfferProposalCard({ proposal, onRespond }: Props) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const offer = proposal.offer;

  async function handleRespond(accept: boolean) {
    setLoading(accept ? "accept" : "reject");
    try {
      const res = await fetch(`/api/shop/offers/${offer.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Erreur");
      }

      toast.success(
        accept
          ? "Offre acceptée ! Sélectionnez vos produits éligibles."
          : "Proposition refusée."
      );
      onRespond(accept);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl border border-amber-200 dark:border-amber-500/30 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* ── Header gradient ── */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-400 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80">Offre proposée par Klik&Go</p>
          <h3 className="text-lg font-bold text-white truncate">{offer.name}</h3>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5 space-y-4">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Qui paie */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={14} className="text-amber-500" />
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Qui paie
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {PAYER_LABELS[offer.payer] || offer.payer}
            </p>
          </div>

          {/* Période */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className="text-blue-500" />
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Période
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatDate(offer.startDate)} — {formatDate(offer.endDate)}
            </p>
          </div>

          {/* Type */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Tag size={14} className="text-purple-500" />
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Type
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {TYPE_LABELS[offer.type] || offer.type}{" "}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({formatDiscount(offer.type, offer.discountValue)})
              </span>
            </p>
          </div>

          {/* Commande min */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={14} className="text-emerald-500" />
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Commande min
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {offer.minOrder > 0
                ? `${offer.minOrder.toFixed(2).replace(".", ",")} \u20AC`
                : "Aucun minimum"}
            </p>
          </div>
        </div>

        {/* Klik&Go payer notice */}
        {offer.payer === "KLIKGO" && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              Klik&Go finance cette offre — vous ne payez rien
            </p>
          </div>
        )}

        {/* Info notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
          <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Si vous acceptez, vous choisirez les produits éligibles dans votre catalogue
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => handleRespond(true)}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-md shadow-emerald-600/20"
          >
            {loading === "accept" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Accepter et choisir mes produits
          </button>
          <button
            onClick={() => handleRespond(false)}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold rounded-xl transition-colors"
          >
            {loading === "reject" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <X size={16} />
            )}
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
