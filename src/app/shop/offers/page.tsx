// src/app/shop/offers/page.tsx — Boucher Offers Dashboard
"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, Plus, Tag, Calendar, Hash, Users, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { OfferProposalCard } from "@/components/shop/offers/OfferProposalCard";
import { ProductSelector } from "@/components/shop/offers/ProductSelector";
import { ButcherOfferForm } from "@/components/shop/offers/ButcherOfferForm";

interface OfferProposal {
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

interface Offer {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  discountValue: number;
  payer: string;
  audience: string;
  startDate: string;
  endDate: string;
  maxUses: number | null;
  _count: { orders: number };
}

function typeBadge(type: string) {
  switch (type) {
    case "PERCENT":
      return { label: "Pourcentage", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" };
    case "AMOUNT":
      return { label: "Montant fixe", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" };
    case "FREE_DELIVERY":
      return { label: "Frais offerts", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" };
    case "BOGO":
      return { label: "1+1 offert", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" };
    case "BUNDLE":
      return { label: "Pack", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300" };
    default:
      return { label: type, color: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" };
    case "PAUSED":
      return { label: "En pause", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" };
    case "DRAFT":
      return { label: "Brouillon", color: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" };
    case "EXPIRED":
      return { label: "Expirée", color: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" };
    default:
      return { label: status, color: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" };
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ShopOffersPage() {
  const [data, setData] = useState<{ proposals: OfferProposal[]; offers: Offer[] }>({ proposals: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectingProducts, setSelectingProducts] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/offers");
      if (!res.ok) throw new Error("Erreur chargement");
      const json = await res.json();
      setData(json.data || { proposals: [], offers: [] });
    } catch {
      toast.error("Impossible de charger les offres");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRespond = async (offerId: string, accept: boolean) => {
    try {
      const res = await fetch(`/api/shop/offers/${offerId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Erreur");
      }
      toast.success(accept ? "Offre acceptée !" : "Offre refusée");

      if (accept) {
        setSelectingProducts(offerId);
      }

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    }
  };

  // Product selector view
  if (selectingProducts) {
    return (
      <ProductSelector
        offerId={selectingProducts}
        onDone={() => {
          setSelectingProducts(null);
          fetchData();
        }}
      />
    );
  }

  // Offer form view
  if (showForm) {
    return (
      <ButcherOfferForm
        onClose={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
            <Gift size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mes Offres</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gérez vos promotions et répondez aux offres Klik&Go
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Créer une offre
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      ) : (
        <>
          {/* Section 1: Pending proposals */}
          {data.proposals.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Propositions en attente
                </h2>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  {data.proposals.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.proposals.map((p) => (
                  <OfferProposalCard key={p.id} proposal={p} onRespond={handleRespond} />
                ))}
              </div>
            </section>
          )}

          {/* Section 2: My offers */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Mes offres
            </h2>

            {data.offers.length === 0 ? (
              <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Package size={24} className="text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                  Aucune offre pour le moment
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Créez votre première promotion pour attirer de nouveaux clients
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.offers.map((offer) => {
                  const tb = typeBadge(offer.type);
                  const sb = statusBadge(offer.status);
                  return (
                    <div
                      key={offer.id}
                      className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5 hover:shadow-md transition-shadow"
                    >
                      {/* Top row: name + status */}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight pr-2">
                          {offer.name}
                        </h3>
                        <span className={`shrink-0 inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${sb.color}`}>
                          {sb.label}
                        </span>
                      </div>

                      {/* Code + type */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300">
                          <Hash size={11} />
                          {offer.code}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${tb.color}`}>
                          {tb.label}
                        </span>
                      </div>

                      {/* Discount value */}
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {offer.type === "PERCENT"
                          ? `-${offer.discountValue}%`
                          : offer.type === "AMOUNT"
                            ? `-${offer.discountValue.toFixed(2)}\u00A0\u20AC`
                            : offer.type === "FREE_DELIVERY"
                              ? "Frais offerts"
                              : offer.type === "BOGO"
                                ? "1+1 offert"
                                : `Pack -${offer.discountValue}%`}
                      </p>

                      {/* Dates + uses */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(offer.startDate)} — {formatDate(offer.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {offer._count.orders} utilisation{offer._count.orders !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Select products button for BOGO/BUNDLE */}
                      {(offer.type === "BOGO" || offer.type === "BUNDLE") && offer.status === "ACTIVE" && (
                        <button
                          onClick={() => setSelectingProducts(offer.id)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                        >
                          <Tag size={13} />
                          Gérer produits éligibles
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
