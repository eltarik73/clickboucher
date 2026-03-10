// src/app/dashboard/marketing/page.tsx — Marketing Hub
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Gift,
  Mail,
  BarChart3,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { OffersList } from "@/components/dashboard/marketing/OffersList";
import { CampaignsList } from "@/components/dashboard/marketing/CampaignsList";
import { OfferForm } from "@/components/dashboard/marketing/OfferForm";
import { CampaignForm } from "@/components/dashboard/marketing/CampaignForm";

type Stats = {
  activeOffers: number;
  campaignsThisMonth: number;
  conversions: number;
  emailsSent: number;
  revenueViaOffers: number;
  roi: number;
};

export default function MarketingHubPage() {
  const [view, setView] = useState<"hub" | "offer-form" | "campaign-form">("hub");
  const [tab, setTab] = useState<"offers" | "campaigns">("offers");
  const [offerFilter, setOfferFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [offers, setOffers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [offersRes, campaignsRes, statsRes] = await Promise.all([
        fetch("/api/dashboard/offers"),
        fetch("/api/dashboard/campaigns"),
        fetch("/api/dashboard/marketing/stats"),
      ]);

      if (offersRes.ok) {
        const json = await offersRes.json();
        setOffers(json.data || []);
      }
      if (campaignsRes.ok) {
        const json = await campaignsRes.json();
        setCampaigns(json.data || []);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data || null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Full-page forms ──
  if (view === "offer-form") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <OfferForm
          onClose={() => setView("hub")}
          onCreated={() => {
            setView("hub");
            fetchData();
          }}
        />
      </div>
    );
  }
  if (view === "campaign-form") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <CampaignForm
          onClose={() => setView("hub")}
          onCreated={() => {
            setView("hub");
            fetchData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ═══════════════════════════════════════════ */}
      {/* ZONE HAUTE — Actions + Stats */}
      {/* ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nouvelle offre */}
        <button
          onClick={() => setView("offer-form")}
          className="relative bg-gradient-to-br from-red-500 to-red-700 rounded-2xl p-6 text-white text-left hover:shadow-lg transition-shadow overflow-hidden group"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
            <Gift size={24} />
          </div>
          <p className="text-xl font-bold">Nouvelle offre</p>
          <p className="text-sm text-white/70 mt-1">Code promo, réduction, 1+1...</p>
          <ChevronRight
            size={20}
            className="absolute bottom-6 right-6 opacity-50 group-hover:opacity-100 transition-opacity"
          />
        </button>

        {/* Nouvelle campagne */}
        <button
          onClick={() => setView("campaign-form")}
          className="relative bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl p-6 text-white text-left hover:shadow-lg transition-shadow overflow-hidden group"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
            <Mail size={24} />
          </div>
          <p className="text-xl font-bold">Nouvelle campagne</p>
          <p className="text-sm text-white/70 mt-1">Email, newsletter, notification...</p>
          <ChevronRight
            size={20}
            className="absolute bottom-6 right-6 opacity-50 group-hover:opacity-100 transition-opacity"
          />
        </button>

        {/* Stats card */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Ce mois</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-gray-300" size={20} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.conversions ?? 0}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Conversions offres</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.emailsSent ?? 0}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Emails envoyés</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {(stats?.revenueViaOffers ?? 0).toFixed(0)}€
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">CA via offres</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {(stats?.roi ?? 0).toFixed(1)}x
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">ROI offres</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ZONE BASSE — Historique */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Tab switch + filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Offres / Campagnes toggle */}
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 p-1 flex gap-1">
            <button
              onClick={() => setTab("offers")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === "offers"
                  ? "bg-red-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
              }`}
            >
              <Gift size={16} />
              Offres
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === "offers" ? "bg-white/20" : "bg-gray-100 dark:bg-white/10"
                }`}
              >
                {offers.length}
              </span>
            </button>
            <button
              onClick={() => setTab("campaigns")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === "campaigns"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
              }`}
            >
              <Mail size={16} />
              Campagnes
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === "campaigns" ? "bg-white/20" : "bg-gray-100 dark:bg-white/10"
                }`}
              >
                {campaigns.length}
              </span>
            </button>
          </div>

          {/* Contextual filters */}
          <div className="flex gap-1.5">
            {tab === "offers" ? (
              <>
                {["all", "KLIKGO", "BUTCHER"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setOfferFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      offerFilter === f
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
                    }`}
                  >
                    {f === "all" ? "Toutes" : f === "KLIKGO" ? "Klik&Go" : "Bouchers"}
                  </button>
                ))}
              </>
            ) : (
              <>
                {["all", "CLIENTS", "BUTCHERS"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setCampaignFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      campaignFilter === f
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
                    }`}
                  >
                    {f === "all" ? "Toutes" : f === "CLIENTS" ? "Clients" : "Bouchers"}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-red-600" size={24} />
          </div>
        ) : tab === "offers" ? (
          <OffersList offers={offers} filter={offerFilter} />
        ) : (
          <CampaignsList campaigns={campaigns} filter={campaignFilter} />
        )}
      </div>
    </div>
  );
}
