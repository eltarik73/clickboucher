// src/app/dashboard/marketing/page.tsx — Marketing Hub
"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, Gift, Mail, BarChart3, TrendingUp, Send, Loader2 } from "lucide-react";
import OffersTab from "@/components/dashboard/marketing/OffersTab";
import CampaignsTab from "@/components/dashboard/marketing/CampaignsTab";
import StatsTab from "@/components/dashboard/marketing/StatsTab";
import OfferForm from "@/components/dashboard/marketing/OfferForm";
import ProposeForm from "@/components/dashboard/marketing/ProposeForm";
import CampaignForm from "@/components/dashboard/marketing/CampaignForm";

type KPI = { label: string; value: string; detail: string; icon: React.ReactNode; color: string };

const TABS = [
  { id: "offers", label: "Offres", icon: Gift },
  { id: "campaigns", label: "Campagnes", icon: Mail },
  { id: "stats", label: "Stats", icon: BarChart3 },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function MarketingHubPage() {
  const [tab, setTab] = useState<Tab>("offers");
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch KPI data
  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/offers").then((r) => r.json()),
      fetch("/api/dashboard/campaigns").then((r) => r.json()),
    ]).then(([offersJson, campaignsJson]) => {
      const offers = offersJson.success ? offersJson.data : [];
      const campaigns = campaignsJson.success ? campaignsJson.data : [];

      const activeOffers = offers.filter((o: any) => o.status === "ACTIVE");
      const klikgoCount = activeOffers.filter((o: any) => o.payer === "KLIKGO").length;
      const boucherCount = activeOffers.filter((o: any) => o.payer === "BUTCHER").length;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthCampaigns = campaigns.filter((c: any) => new Date(c.createdAt) >= monthStart);
      const clientCampaigns = thisMonthCampaigns.filter((c: any) => c.audience?.startsWith("CLIENTS_"));
      const boucherCampaigns = thisMonthCampaigns.filter((c: any) => c.audience?.startsWith("BUTCHERS_"));

      const totalOrders = offers.reduce((sum: number, o: any) => sum + (o._count?.orders || 0), 0);
      const totalAllOrders = Math.max(totalOrders, 1);
      const convPct = totalOrders > 0 ? Math.round((totalOrders / totalAllOrders) * 100) : 0;

      const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.sentCount || 0), 0);
      const totalOpened = campaigns.reduce((sum: number, c: any) => sum + (c.openedCount || 0), 0);
      const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

      setKpis([
        {
          label: "Offres actives",
          value: String(activeOffers.length),
          detail: `${klikgoCount} Klik&Go · ${boucherCount} boucher`,
          icon: <Gift className="w-5 h-5" />,
          color: "bg-red-50 text-red-600",
        },
        {
          label: "Campagnes ce mois",
          value: String(thisMonthCampaigns.length),
          detail: `${clientCampaigns.length} clients · ${boucherCampaigns.length} bouchers`,
          icon: <Mail className="w-5 h-5" />,
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: "Conversions",
          value: String(totalOrders),
          detail: `${convPct}% des commandes`,
          icon: <TrendingUp className="w-5 h-5" />,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Emails envoyés",
          value: String(totalSent),
          detail: `${openRate}% ouverture`,
          icon: <Send className="w-5 h-5" />,
          color: "bg-purple-50 text-purple-600",
        },
      ]);
    }).catch(() => {});
  }, [refreshKey]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center shadow-lg">
          <Megaphone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Offres, campagnes, stats</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.color}`}>
                {kpi.icon}
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.detail}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-1.5 flex gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "offers" && (
        <OffersTab
          key={refreshKey}
          onCreateKlikgo={() => setShowOfferForm(true)}
          onPropose={() => setShowProposeForm(true)}
        />
      )}
      {tab === "campaigns" && (
        <CampaignsTab
          key={refreshKey}
          onCreateCampaign={() => setShowCampaignForm(true)}
        />
      )}
      {tab === "stats" && <StatsTab key={refreshKey} />}

      {/* Modals */}
      {showOfferForm && (
        <OfferForm
          onClose={() => setShowOfferForm(false)}
          onCreated={() => { setShowOfferForm(false); refresh(); }}
        />
      )}
      {showProposeForm && (
        <ProposeForm
          onClose={() => setShowProposeForm(false)}
          onCreated={() => { setShowProposeForm(false); refresh(); }}
        />
      )}
      {showCampaignForm && (
        <CampaignForm
          onClose={() => setShowCampaignForm(false)}
          onCreated={() => { setShowCampaignForm(false); refresh(); }}
        />
      )}
    </div>
  );
}
