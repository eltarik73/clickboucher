"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, Mail, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types (re-used from sibling tabs)
// ---------------------------------------------------------------------------

type Offer = {
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
  createdAt: string;
  shop: { id: string; name: string; slug: string } | null;
  _count: { proposals: number; eligibleProducts: number; orders: number };
};

type Campaign = {
  id: string;
  title: string;
  type: string;
  audience: string;
  subject: string;
  body: string;
  status: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  offer: { id: string; code: string; name: string; type: string } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const MONTH_NAMES = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];

function isClientAudience(audience: string): boolean {
  return audience.startsWith("CLIENTS_");
}

function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function safePercent(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 100);
}

function formatEur(cents: number): string {
  if (cents >= 100000) return `${(cents / 100).toFixed(0)}€`;
  if (cents >= 10000) return `${(cents / 100).toFixed(0)}€`;
  return `${(cents / 100).toFixed(2)}€`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatsTab() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Fetch both endpoints in parallel ------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [offersRes, campaignsRes] = await Promise.all([
        fetch("/api/dashboard/offers"),
        fetch("/api/dashboard/campaigns"),
      ]);

      const offersJson = await offersRes.json();
      const campaignsJson = await campaignsRes.json();

      if (offersJson.success) setOffers(offersJson.data);
      else toast.error("Impossible de charger les offres");

      if (campaignsJson.success) setCampaigns(campaignsJson.data);
      else toast.error("Impossible de charger les campagnes");
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Computed stats -------------------------------------------------------

  // Top 3 offers by currentUses
  const topOffers = [...offers]
    .sort((a, b) => b.currentUses - a.currentUses)
    .slice(0, 3);

  // Email performance — split by audience
  const clientCampaigns = campaigns.filter((c) => isClientAudience(c.audience));
  const butcherCampaigns = campaigns.filter((c) => !isClientAudience(c.audience));

  const clientSentTotal = clientCampaigns.reduce((s, c) => s + c.sentCount, 0);
  const clientOpenedTotal = clientCampaigns.reduce((s, c) => s + c.openedCount, 0);
  const clientClickedTotal = clientCampaigns.reduce((s, c) => s + c.clickedCount, 0);

  const butcherSentTotal = butcherCampaigns.reduce((s, c) => s + c.sentCount, 0);
  const butcherOpenedTotal = butcherCampaigns.reduce((s, c) => s + c.openedCount, 0);
  const butcherClickedTotal = butcherCampaigns.reduce((s, c) => s + c.clickedCount, 0);

  const clientOpenRate = safePercent(clientOpenedTotal, clientSentTotal);
  const clientClickRate = safePercent(clientClickedTotal, clientSentTotal);
  const butcherOpenRate = safePercent(butcherOpenedTotal, butcherSentTotal);
  const butcherClickRate = safePercent(butcherClickedTotal, butcherSentTotal);

  // Monthly KPIs (current month)
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // Orders with offer this month — approximate from _count.orders on offers created/active
  const ordersWithOffer = offers.reduce((s, o) => s + o._count.orders, 0);

  // CA via offers — approximate: currentUses * discountValue (in cents equivalent)
  const avgDiscount =
    offers.length > 0
      ? offers.reduce((s, o) => s + o.discountValue, 0) / offers.length
      : 0;
  const caViaOffers = offers.reduce((s, o) => s + o.currentUses * o.discountValue, 0);

  // Cost for Klik&Go — only KLIKGO payer offers
  const klikgoOffers = offers.filter((o) => o.payer === "KLIKGO");
  const coutKlikgo = klikgoOffers.reduce(
    (s, o) => s + o.currentUses * o.discountValue,
    0
  );

  // ROI — ratio of total uses revenue to cost
  const roi = coutKlikgo > 0 ? (caViaOffers / coutKlikgo).toFixed(1) : null;

  // Emails sent this month
  const emailsThisMonth = campaigns
    .filter((c) => {
      const dateRef = c.sentAt || c.createdAt;
      return isThisMonth(dateRef);
    })
    .reduce((s, c) => s + c.sentCount, 0);

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
      {/* ---- 2-column grid: Top Offers + Email Performance ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1 — Top offres */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-gray-900">Top offres</h3>
          </div>

          {topOffers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              Aucune offre encore
            </p>
          ) : (
            <div className="space-y-3">
              {topOffers.map((offer, idx) => {
                const rankStyles = [
                  "bg-red-50 text-red-600",
                  "bg-gray-100 text-gray-600",
                  "bg-gray-50 text-gray-400",
                ];
                const typeBadge = TYPE_BADGE[offer.type] ?? {
                  label: offer.type,
                  className: "bg-gray-100 text-gray-600",
                };

                return (
                  <div
                    key={offer.id}
                    className="flex items-center gap-3"
                  >
                    {/* Rank badge */}
                    <span
                      className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${rankStyles[idx]}`}
                    >
                      #{idx + 1}
                    </span>

                    {/* Code + name */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <code className="bg-gray-50 rounded-lg px-2 py-0.5 text-xs font-mono text-gray-600">
                        {offer.code}
                      </code>
                      <span className="text-sm text-gray-700 truncate">
                        {offer.name}
                      </span>
                    </div>

                    {/* Uses count */}
                    <span className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
                      {offer.currentUses} utilisations
                    </span>

                    {/* Type badge */}
                    <span
                      className={`flex-shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeBadge.className}`}
                    >
                      {typeBadge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 2 — Performance emails */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Performance emails
            </h3>
          </div>

          <div className="space-y-4">
            {/* Clients — Ouverture */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  Clients — Ouverture
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {clientOpenRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(clientOpenRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Clients — Clics */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Clients — Clics</span>
                <span className="text-sm font-semibold text-gray-900">
                  {clientClickRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-red-400 transition-all"
                  style={{ width: `${Math.min(clientClickRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Bouchers — Ouverture */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  Bouchers — Ouverture
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {butcherOpenRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(butcherOpenRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Bouchers — Clics */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  Bouchers — Clics
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {butcherClickRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(butcherClickRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Card 3 — Monthly KPIs (full width) ---- */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          {/* KPI 1 — Commandes avec offre */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Cmd avec offre
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {ordersWithOffer}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              sur {offers.length} offres
            </p>
          </div>

          {/* KPI 2 — CA via offres */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              CA via offres
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatEur(caViaOffers)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              moy. {avgDiscount > 0 ? formatEur(avgDiscount) : "—"} / offre
            </p>
          </div>

          {/* KPI 3 — Cout Klik&Go */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Cout Klik&Go
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatEur(coutKlikgo)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {klikgoOffers.length} offres Klik&Go
            </p>
          </div>

          {/* KPI 4 — ROI */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">ROI</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {roi ? `x${roi}` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {roi ? "CA / cout" : "pas de donnees"}
            </p>
          </div>

          {/* KPI 5 — Emails envoyes */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Emails envoyes
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {emailsThisMonth}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {campaigns.length} campagnes total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
