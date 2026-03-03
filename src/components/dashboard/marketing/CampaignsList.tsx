"use client";

import {
  Mail,
  PartyPopper,
  RefreshCw,
  Gift,
  Smartphone,
  Bell,
  BarChart3,
  BookOpen,
  Send,
  ChevronRight,
  Clock,
  Zap,
} from "lucide-react";

type Campaign = {
  id: string;
  title: string;
  type: string;
  audience: string;
  subject: string;
  status: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  offer?: { id: string; name: string; code: string } | null;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  NEWSLETTER: Mail,
  ONBOARDING: PartyPopper,
  REACTIVATION: RefreshCw,
  PROMO: Gift,
  UPDATE: Smartphone,
  REMINDER: Bell,
  REPORT: BarChart3,
  EDUCATION: BookOpen,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SENT":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
          Envoy&eacute;
        </span>
      );
    case "SCHEDULED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
          <Clock className="h-3 w-3" />
          Planifi&eacute;
        </span>
      );
    case "SENDING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          <Zap className="h-3 w-3" />
          Envoi
        </span>
      );
    case "PAUSED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          En pause
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
          Brouillon
        </span>
      );
  }
}

function AudienceBadge({ audience }: { audience: string }) {
  if (audience.includes("CLIENTS")) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
        Clients
      </span>
    );
  }
  if (audience.includes("BUTCHERS")) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        Bouchers
      </span>
    );
  }
  return null;
}

export function CampaignsList({
  campaigns,
  filter,
  onSelect,
}: {
  campaigns: Campaign[];
  filter: string;
  onSelect?: (campaign: Campaign) => void;
}) {
  const filtered =
    filter === "all"
      ? campaigns
      : campaigns.filter((c) => c.audience.includes(filter));

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
          <Mail className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Aucune campagne
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Cr&eacute;ez votre premi&egrave;re campagne email
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((campaign) => {
        const Icon = TYPE_ICONS[campaign.type] || Mail;
        const isClients = campaign.audience.includes("CLIENTS");
        const displayDate = campaign.sentAt || campaign.createdAt;
        const openRate =
          campaign.sentCount > 0
            ? Math.round((campaign.openedCount / campaign.sentCount) * 100)
            : 0;

        return (
          <div
            key={campaign.id}
            onClick={() => onSelect?.(campaign)}
            className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4 hover:shadow-sm dark:border-white/10 dark:bg-[#141414]"
          >
            {/* Left icon */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isClients
                  ? "bg-red-50 dark:bg-red-500/10"
                  : "bg-amber-50 dark:bg-amber-500/10"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isClients
                    ? "text-red-500 dark:text-red-400"
                    : "text-amber-500 dark:text-amber-400"
                }`}
              />
            </div>

            {/* Content middle */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {campaign.title}
                </span>
                <StatusBadge status={campaign.status} />
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                  {campaign.type}
                </span>
                <AudienceBadge audience={campaign.audience} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <Send className="h-3 w-3" />
                <span>{campaign.sentCount} envoy&eacute;s</span>
                {campaign.sentCount > 0 && (
                  <span className="text-gray-300 dark:text-gray-600">
                    &middot; {openRate}% ouverture
                  </span>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-gray-400">
                {formatDate(displayDate)}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
