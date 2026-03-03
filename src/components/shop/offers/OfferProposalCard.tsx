// src/components/shop/offers/OfferProposalCard.tsx — Webmaster offer proposal card for boucher
"use client";

import { useState } from "react";
import {
  Crown,
  Calendar,
  Tag,
  ShoppingCart,
  DollarSign,
  Info,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface Proposal {
  id: string;
  offerId: string;
  status: string;
  offer: {
    name: string;
    code: string;
    type: string;
    discountValue: number;
    payer: string;
    audience: string;
    startDate: string;
    endDate: string;
    minOrder: number;
  };
}

function typeLabel(type: string) {
  switch (type) {
    case "PERCENT":
      return "Pourcentage";
    case "AMOUNT":
      return "Montant fixe";
    case "FREE_DELIVERY":
      return "Livraison offerte";
    case "BOGO":
      return "1+1 offert";
    case "BUNDLE":
      return "Pack";
    default:
      return type;
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OfferProposalCard({
  proposal,
  onRespond,
}: {
  proposal: Proposal;
  onRespond: (offerId: string, accept: boolean) => void;
}) {
  const [responding, setResponding] = useState<"accept" | "reject" | null>(null);
  const { offer } = proposal;

  const handleRespond = async (accept: boolean) => {
    setResponding(accept ? "accept" : "reject");
    try {
      await onRespond(proposal.offerId, accept);
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border-2 border-amber-200 dark:border-amber-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 dark:bg-amber-500/10 px-5 py-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          {offer.name}
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          Offre proposée par Klik&Go
        </p>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* 2x2 detail grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Qui paie */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <Crown size={14} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Qui paie
              </p>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {offer.payer === "KLIKGO" ? "Klik&Go" : "Boucher"}
              </p>
            </div>
          </div>

          {/* Période */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Période
              </p>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {formatDate(offer.startDate)} — {formatDate(offer.endDate)}
              </p>
            </div>
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
              <Tag size={14} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Type
              </p>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {typeLabel(offer.type)}{" "}
                {offer.type === "PERCENT"
                  ? `(-${offer.discountValue}%)`
                  : offer.type === "AMOUNT"
                    ? `(-${offer.discountValue.toFixed(2)}\u00A0\u20AC)`
                    : ""}
              </p>
            </div>
          </div>

          {/* Commande min */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <ShoppingCart size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Cmd min
              </p>
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {offer.minOrder > 0 ? `${offer.minOrder.toFixed(2)}\u00A0\u20AC` : "Aucun"}
              </p>
            </div>
          </div>
        </div>

        {/* Klik&Go pays info box */}
        {offer.payer === "KLIKGO" && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
            <DollarSign size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              <span className="font-semibold">Klik&Go finance cette offre</span> — vous ne payez rien,
              la réduction est prise en charge par la plateforme.
            </p>
          </div>
        )}

        {/* Product selection info */}
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
          <Info size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Si vous acceptez, vous choisirez les produits éligibles à cette offre.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRespond(true)}
            disabled={responding !== null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {responding === "accept" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Accepter
          </button>
          <button
            onClick={() => handleRespond(false)}
            disabled={responding !== null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-xl transition-colors"
          >
            {responding === "reject" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <X size={15} />
            )}
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
