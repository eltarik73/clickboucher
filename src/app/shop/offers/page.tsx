"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Store,
  Gift,
  Bell,
  Ticket,
  Calendar,
  Plus,
  Loader2,
  Tag,
  Eye,
  EyeOff,
  Clock,
  Users,
  Hash,
  Sparkles,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import OfferProposalCard from "@/components/shop/offers/OfferProposalCard";
import ProductSelector from "@/components/shop/offers/ProductSelector";
import ButcherOfferForm from "@/components/shop/offers/ButcherOfferForm";

// ── Types ──────────────────────────────────────────────────
type Offer = {
  id: string;
  name: string;
  code: string;
  type: string;
  discountValue: number;
  minOrder: number;
  payer: string;
  audience: string;
  startDate: string;
  endDate: string;
  maxUses: number | null;
  currentUses: number;
  status: string;
  diffBadge: boolean;
  diffBanner: boolean;
  diffPopup: boolean;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerColor?: string;
  _count: { eligibleProducts: number; orders: number };
};

type Proposal = {
  id: string;
  offerId: string;
  status: string;
  respondedAt: string | null;
  createdAt: string;
  offer: {
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
};

// ── Helpers ────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  PERCENT: "% Réduction",
  AMOUNT: "Montant fixe",
  FREE_DELIVERY: "Frais offerts",
  BOGO: "1+1 Offert",
  BUNDLE: "Pack",
};

const TYPE_COLORS: Record<string, string> = {
  PERCENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AMOUNT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  FREE_DELIVERY: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  BOGO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  BUNDLE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  PAUSED: { label: "En pause", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  DRAFT: { label: "Brouillon", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  EXPIRED: { label: "Expirée", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

function formatDiscount(type: string, value: number): string {
  if (type === "PERCENT") return `-${value}%`;
  if (type === "AMOUNT") return `-${value.toFixed(2).replace(".", ",")} \u20AC`;
  if (type === "FREE_DELIVERY") return "Frais offerts";
  if (type === "BOGO") return "1+1 offert";
  if (type === "BUNDLE") return `Pack -${value}%`;
  return String(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Main Page ──────────────────────────────────────────────
export default function ShopOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectingProductsFor, setSelectingProductsFor] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/offers");
      if (!res.ok) throw new Error("Erreur chargement");
      const json = await res.json();
      setOffers(json.data?.offers || []);
      setProposals(json.data?.proposals || []);
    } catch {
      toast.error("Impossible de charger vos offres");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── KPIs ──
  const pendingProposals = proposals.filter((p) => p.status === "PENDING");
  const activeOffers = offers.filter((o) => o.status === "ACTIVE");
  const totalUses = offers.reduce((sum, o) => sum + o.currentUses, 0);
  const thisMonthUses = offers.reduce((sum, o) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (new Date(o.startDate) >= start) return sum + o.currentUses;
    return sum;
  }, 0);

  // ── Toggle offer status ──
  async function toggleOfferStatus(offer: Offer) {
    setTogglingId(offer.id);
    const newStatus = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch("/api/shop/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "ACTIVE" ? "Offre activée" : "Offre mise en pause");
      fetchData();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setTogglingId(null);
    }
  }

  // ── Handle proposal response ──
  function handleProposalResponded(proposal: Proposal, accepted: boolean) {
    fetchData();
    if (accepted) {
      setSelectingProductsFor(proposal.offer.id);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // ── Product selector overlay ──
  if (selectingProductsFor) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-4 sm:p-6">
        <ProductSelector
          offerId={selectingProductsFor}
          onDone={() => {
            setSelectingProductsFor(null);
            fetchData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mes Offres</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gérez vos offres et propositions
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-red-600/20"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Créer une offre</span>
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Offres actives",
              value: activeOffers.length,
              icon: Gift,
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
              label: "Propositions",
              value: pendingProposals.length,
              icon: Bell,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-900/20",
              highlight: pendingProposals.length > 0,
            },
            {
              label: "Utilisations total",
              value: totalUses,
              icon: Ticket,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              label: "Ce mois",
              value: thisMonthUses,
              icon: Calendar,
              color: "text-purple-600 dark:text-purple-400",
              bg: "bg-purple-50 dark:bg-purple-900/20",
            },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className={`bg-white dark:bg-white/5 rounded-xl border ${
                  kpi.highlight
                    ? "border-amber-300 dark:border-amber-500/30"
                    : "border-gray-100 dark:border-white/10"
                } p-4 transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <Icon size={16} className={kpi.color} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* ── Pending Proposals ── */}
        {pendingProposals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Propositions en attente
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
                {pendingProposals.length}
              </span>
            </div>
            <div className="space-y-3 border-l-4 border-amber-400 pl-4">
              {pendingProposals.map((proposal) => (
                <OfferProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onRespond={(accepted) => handleProposalResponded(proposal, accepted)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── My Offers ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mes offres</h2>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-xs font-bold">
              {offers.length}
            </span>
          </div>

          {offers.length === 0 ? (
            <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 p-8 text-center">
              <Gift className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune offre créée</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Créez votre première offre pour attirer de nouveaux clients
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => {
                const statusCfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG.DRAFT;
                const isActive = offer.status === "ACTIVE";
                const isPaused = offer.status === "PAUSED";
                const canToggle = isActive || isPaused;

                return (
                  <div
                    key={offer.id}
                    className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">
                            {offer.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              TYPE_COLORS[offer.type] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {TYPE_LABELS[offer.type] || offer.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusCfg.color}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Hash size={12} />
                            {offer.code}
                          </span>
                          <span className="flex items-center gap-1">
                            <Tag size={12} />
                            {formatDiscount(offer.type, offer.discountValue)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(offer.startDate)} - {formatDate(offer.endDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {offer.currentUses}
                            {offer.maxUses ? `/${offer.maxUses}` : ""} util.
                          </span>
                          {offer._count.eligibleProducts > 0 && (
                            <span className="flex items-center gap-1">
                              <Package size={12} />
                              {offer._count.eligibleProducts} produit
                              {offer._count.eligibleProducts > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: toggle + products */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectingProductsFor(offer.id)}
                          className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                          title="Gérer les produits éligibles"
                        >
                          <Package size={16} />
                        </button>
                        {canToggle && (
                          <button
                            onClick={() => toggleOfferStatus(offer)}
                            disabled={togglingId === offer.id}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                              isActive
                                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                            }`}
                          >
                            {togglingId === offer.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isActive ? (
                              <>
                                <EyeOff size={14} />
                                Pause
                              </>
                            ) : (
                              <>
                                <Eye size={14} />
                                Activer
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Form Modal ── */}
      {showCreateForm && (
        <ButcherOfferForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
