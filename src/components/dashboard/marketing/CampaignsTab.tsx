"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  ChefHat,
  Plus,
  Info,
  Mail,
  PartyPopper,
  RefreshCw,
  Gift,
  Smartphone,
  Bell,
  BarChart3,
  BookOpen,
  ChevronRight,
  Loader2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CampaignType =
  | "NEWSLETTER"
  | "ONBOARDING"
  | "REACTIVATION"
  | "PROMO"
  | "UPDATE"
  | "REMINDER"
  | "REPORT"
  | "EDUCATION";

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "PAUSED";

type CampaignAudience =
  | "CLIENTS_ALL"
  | "CLIENTS_NEW"
  | "CLIENTS_LOYAL"
  | "CLIENTS_INACTIVE"
  | "BUTCHERS_ALL"
  | "BUTCHERS_NEW"
  | "BUTCHERS_ACTIVE";

type Campaign = {
  id: string;
  title: string;
  type: CampaignType;
  audience: CampaignAudience;
  subject: string;
  body: string;
  status: CampaignStatus;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  offer: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
};

type AudienceFilter = "CLIENTS" | "BUTCHERS";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<CampaignType, React.ComponentType<{ className?: string }>> = {
  NEWSLETTER: Mail,
  ONBOARDING: PartyPopper,
  REACTIVATION: RefreshCw,
  PROMO: Gift,
  UPDATE: Smartphone,
  REMINDER: Bell,
  REPORT: BarChart3,
  EDUCATION: BookOpen,
};

const TYPE_LABEL: Record<CampaignType, string> = {
  NEWSLETTER: "Newsletter",
  ONBOARDING: "Onboarding",
  REACTIVATION: "Relance",
  PROMO: "Promo",
  UPDATE: "Mise a jour",
  REMINDER: "Rappel",
  REPORT: "Rapport",
  EDUCATION: "Formation",
};

const STATUS_BADGE: Record<CampaignStatus, { label: string; className: string }> = {
  SENT: { label: "Envoye", className: "bg-blue-50 text-blue-600" },
  DRAFT: { label: "Brouillon", className: "bg-gray-100 text-gray-500" },
  SCHEDULED: { label: "Programme", className: "bg-purple-50 text-purple-600" },
  SENDING: { label: "Envoi en cours", className: "bg-emerald-50 text-emerald-600" },
  PAUSED: { label: "Pause", className: "bg-amber-50 text-amber-600" },
};

function isClientAudience(a: CampaignAudience): boolean {
  return a.startsWith("CLIENTS_");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignsTab({
  onCreateCampaign,
}: {
  onCreateCampaign?: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState<AudienceFilter>("CLIENTS");

  // ---- Fetch ----------------------------------------------------------------

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/campaigns");
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data);
      } else {
        toast.error("Impossible de charger les campagnes");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ---- Filter ---------------------------------------------------------------

  const clientCampaigns = campaigns.filter((c) => isClientAudience(c.audience));
  const butcherCampaigns = campaigns.filter((c) => !isClientAudience(c.audience));

  const filtered =
    audience === "CLIENTS" ? clientCampaigns : butcherCampaigns;

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
        {/* Audience switch */}
        <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1">
          <button
            onClick={() => setAudience("CLIENTS")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
              audience === "CLIENTS"
                ? "bg-red-600 text-white rounded-lg shadow-sm"
                : "text-gray-500 hover:bg-gray-50 rounded-lg"
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Clients
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                audience === "CLIENTS"
                  ? "bg-white/20"
                  : "bg-gray-100"
              }`}
            >
              {clientCampaigns.length}
            </span>
          </button>
          <button
            onClick={() => setAudience("BUTCHERS")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
              audience === "BUTCHERS"
                ? "bg-amber-500 text-white rounded-lg shadow-sm"
                : "text-gray-500 hover:bg-gray-50 rounded-lg"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            Bouchers
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                audience === "BUTCHERS"
                  ? "bg-white/20"
                  : "bg-gray-100"
              }`}
            >
              {butcherCampaigns.length}
            </span>
          </button>
        </div>

        {/* Create button */}
        {onCreateCampaign && (
          <button
            onClick={onCreateCampaign}
            className="inline-flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-red-700 transition"
          >
            <Plus className="h-4 w-4" />
            Nouvelle campagne
          </button>
        )}
      </div>

      {/* ---- Info banner ---- */}
      {audience === "CLIENTS" ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">
            Newsletters, annonces de nouvelles boucheries, relances clients
            inactifs, promos exclusives...
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Mises a jour plateforme, rappels de commandes, rapports de
            performance, formations...
          </p>
        </div>
      )}

      {/* ---- Empty state ---- */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <Megaphone className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            Aucune campagne
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {audience === "CLIENTS"
              ? "Creez votre premiere campagne pour engager vos clients."
              : "Creez votre premiere campagne pour communiquer avec vos bouchers."}
          </p>
          {onCreateCampaign && (
            <button
              onClick={onCreateCampaign}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition"
            >
              <Plus className="h-4 w-4" />
              Nouvelle campagne
            </button>
          )}
        </div>
      )}

      {/* ---- Campaign list ---- */}
      <div className="space-y-2">
        {filtered.map((campaign) => {
          const IconComponent = TYPE_ICON[campaign.type] ?? Mail;
          const typeLabel = TYPE_LABEL[campaign.type] ?? campaign.type;
          const statusBadge = STATUS_BADGE[campaign.status] ?? {
            label: campaign.status,
            className: "bg-gray-100 text-gray-500",
          };
          const isClient = isClientAudience(campaign.audience);
          const openRate =
            campaign.sentCount > 0
              ? Math.round((campaign.openedCount / campaign.sentCount) * 100)
              : 0;

          return (
            <div
              key={campaign.id}
              className="group relative bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:shadow-sm transition cursor-pointer"
            >
              {/* Left icon */}
              <div
                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${
                  isClient ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                <IconComponent
                  className={`h-5 w-5 ${
                    isClient ? "text-red-600" : "text-amber-500"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Line 1 — title + status badge + type badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">
                    {campaign.title}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {typeLabel}
                  </span>
                </div>

                {/* Line 2 — subject truncated */}
                <p className="mt-1 text-xs text-gray-400 truncate">
                  {campaign.subject}
                </p>
              </div>

              {/* Right — stats + date + chevron */}
              <div className="flex items-center gap-5 flex-shrink-0">
                {/* Stats */}
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {campaign.sentCount} envoyes
                  </span>
                  <span className="text-xs text-gray-400">
                    {openRate}% ouvert
                  </span>
                </div>

                {/* Date */}
                <span className="hidden md:block text-xs text-gray-400 whitespace-nowrap">
                  {campaign.sentAt
                    ? formatDate(campaign.sentAt)
                    : formatDate(campaign.createdAt)}
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
