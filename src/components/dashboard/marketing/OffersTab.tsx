"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Crown,
  Store,
  Tag,
  PanelTop,
  MousePointerClick,
  Mail,
  Users,
  Calendar,
  Ticket,
  ChevronRight,
  Plus,
  Zap,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Offer = {
  id: string;
  shopId: string | null;
  name: string;
  code: string;
  type: "PERCENT" | "AMOUNT" | "FREE_DELIVERY" | "BOGO" | "BUNDLE";
  discountValue: number;
  minOrder: number;
  payer: "KLIKGO" | "BUTCHER";
  audience: "ALL" | "NEW" | "LOYAL" | "VIP";
  startDate: string;
  endDate: string;
  maxUses: number | null;
  currentUses: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "DRAFT";
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
  _count: { proposals: number; eligibleProducts: number; orders: number };
};

type PayerFilter = "all" | "KLIKGO" | "BUTCHER";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Tous les clients",
  NEW: "Nouveaux clients",
  LOYAL: "Clients fideles",
  VIP: "Clients VIP",
};

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  PERCENT: { label: "Pourcentage", className: "bg-purple-50 text-purple-600" },
  BOGO: { label: "1+1 Offert", className: "bg-pink-50 text-pink-600" },
  FREE_DELIVERY: {
    label: "Livraison offerte",
    className: "bg-emerald-50 text-emerald-600",
  },
  AMOUNT: { label: "Montant fixe", className: "bg-blue-50 text-blue-600" },
  BUNDLE: { label: "Pack", className: "bg-blue-50 text-blue-600" },
};

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-600" },
  PAUSED: { label: "En pause", className: "bg-amber-50 text-amber-600" },
  EXPIRED: { label: "Expirée", className: "bg-gray-100 text-gray-500" },
  DRAFT: { label: "Brouillon", className: "bg-gray-50 text-gray-400" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OffersTab({
  onCreateKlikgo,
  onPropose,
  onEdit,
}: {
  onCreateKlikgo?: () => void;
  onPropose?: () => void;
  onEdit?: (offer: Offer) => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [payerFilter, setPayerFilter] = useState<PayerFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---- Fetch ----------------------------------------------------------------

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/offers");
      const json = await res.json();
      if (json.success) {
        setOffers(json.data);
      } else {
        toast.error("Impossible de charger les offres");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // ---- Filter ---------------------------------------------------------------

  const filtered = offers.filter((o) => {
    if (payerFilter === "all") return true;
    return o.payer === payerFilter;
  });

  const countAll = offers.length;
  const countKlikgo = offers.filter((o) => o.payer === "KLIKGO").length;
  const countBoucher = offers.filter((o) => o.payer === "BUTCHER").length;

  // ---- Pause / Resume -------------------------------------------------------

  const toggleStatus = useCallback(
    async (offer: Offer, e: React.MouseEvent) => {
      e.stopPropagation();
      if (togglingId) return;
      const next = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      setTogglingId(offer.id);
      try {
        const res = await fetch(`/api/dashboard/offers/${offer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const json = await res.json();
        if (json.success) {
          setOffers((prev) =>
            prev.map((o) => (o.id === offer.id ? { ...o, status: next } : o))
          );
          toast.success(
            next === "PAUSED" ? "Offre mise en pause" : "Offre reactivee"
          );
        } else {
          toast.error("Erreur lors de la mise a jour");
        }
      } catch {
        toast.error("Erreur reseau");
      } finally {
        setTogglingId(null);
      }
    },
    [togglingId]
  );

  // ---- Render ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---- Toolbar ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-2">
          {([
            { key: "all" as const, label: "Toutes", count: countAll },
            { key: "KLIKGO" as const, label: "Klik&Go", count: countKlikgo },
            { key: "BUTCHER" as const, label: "Bouchers", count: countBoucher },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setPayerFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition ${
                payerFilter === key
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl"
                  : "bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
              }`}
            >
              {label}
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  payerFilter === key
                    ? "bg-white/20 text-white dark:bg-black/20 dark:text-gray-900"
                    : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onPropose && (
            <button
              onClick={onPropose}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition"
            >
              <Store className="h-4 w-4" />
              Proposer au boucher
            </button>
          )}
          {onCreateKlikgo && (
            <button
              onClick={onCreateKlikgo}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition"
            >
              <Crown className="h-4 w-4" />
              Offre Klik&Go
            </button>
          )}
        </div>
      </div>

      {/* ---- Empty state ---- */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/10 mb-4">
            <Zap className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Aucune offre</p>
          <p className="mt-1 text-sm text-gray-500">
            Creez votre premiere offre pour booster les ventes.
          </p>
          {onCreateKlikgo && (
            <button
              onClick={onCreateKlikgo}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition"
            >
              <Plus className="h-4 w-4" />
              Nouvelle offre
            </button>
          )}
        </div>
      )}

      {/* ---- List ---- */}
      <div className="space-y-2">
        {filtered.map((offer) => {
          const typeBadge = TYPE_BADGE[offer.type] ?? {
            label: offer.type,
            className: "bg-gray-100 text-gray-600",
          };
          const statusBadge = STATUS_BADGE[offer.status] ?? {
            label: offer.status,
            className: "bg-gray-100 text-gray-500",
          };
          const canToggle =
            offer.status === "ACTIVE" || offer.status === "PAUSED";

          return (
            <div
              key={offer.id}
              onClick={() => onEdit?.(offer)}
              className="group relative bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 px-5 py-4 flex items-center gap-4 hover:shadow-sm transition cursor-pointer"
            >
              {/* Payer icon */}
              <div
                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${
                  offer.payer === "KLIKGO"
                    ? "bg-red-50"
                    : "bg-amber-50"
                }`}
              >
                {offer.payer === "KLIKGO" ? (
                  <Crown className="h-5 w-5 text-red-600" />
                ) : (
                  <Store className="h-5 w-5 text-amber-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Line 1 — name + badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {offer.name}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeBadge.className}`}
                  >
                    {typeBadge.label}
                  </span>
                  <code className="bg-gray-100 rounded-lg px-2 py-0.5 text-xs font-mono text-gray-600">
                    {offer.code}
                  </code>
                  {offer.shop && (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                      {offer.shop.name}
                    </span>
                  )}
                </div>

                {/* Line 2 — metadata + diffusion */}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {AUDIENCE_LABELS[offer.audience] ?? offer.audience}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(offer.startDate)} — {formatDate(offer.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" />
                    {offer.maxUses
                      ? `${offer.currentUses}/${offer.maxUses} utilisations`
                      : `${offer.currentUses} utilisations`}
                  </span>

                  <span className="text-gray-300">|</span>

                  {/* Diffusion icons */}
                  <span className="inline-flex items-center gap-2">
                    <Tag
                      className={`h-3.5 w-3.5 ${
                        offer.diffBadge ? "text-red-500" : "text-gray-200"
                      }`}
                    />
                    <PanelTop
                      className={`h-3.5 w-3.5 ${
                        offer.diffBanner ? "text-red-500" : "text-gray-200"
                      }`}
                    />
                    <MousePointerClick
                      className={`h-3.5 w-3.5 ${
                        offer.diffPopup ? "text-red-500" : "text-gray-200"
                      }`}
                    />
                    <Mail
                      className={`h-3.5 w-3.5 ${
                        offer._count.proposals > 0
                          ? "text-red-500"
                          : "text-gray-200"
                      }`}
                    />
                  </span>
                </div>
              </div>

              {/* Right — toggle + status + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {canToggle && (
                  <button
                    onClick={(e) => toggleStatus(offer, e)}
                    disabled={togglingId === offer.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"
                    title={
                      offer.status === "ACTIVE"
                        ? "Mettre en pause"
                        : "Reactiver"
                    }
                  >
                    {togglingId === offer.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : offer.status === "ACTIVE" ? (
                      <Pause className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Play className="h-4 w-4 text-emerald-500" />
                    )}
                  </button>
                )}
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
