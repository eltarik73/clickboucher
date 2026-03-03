"use client";

import {
  Crown,
  Store,
  Users,
  Calendar,
  Ticket,
  Tag,
  PanelTop,
  MousePointerClick,
  ChevronRight,
  Gift,
} from "lucide-react";

type Offer = {
  id: string;
  name: string;
  code: string;
  type: string;
  discountValue: number;
  minOrder: number;
  payer: string;
  audience: string;
  status: string;
  startDate: string;
  endDate: string;
  maxUses: number | null;
  currentUses: number;
  diffBadge: boolean;
  diffBanner: boolean;
  diffPopup: boolean;
  shop?: { id: string; name: string; slug: string } | null;
  _count?: { proposals: number; eligibleProducts: number; orders: number };
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function getDiscountBadge(type: string, discountValue: number) {
  switch (type) {
    case "PERCENT":
      return {
        label: `-${discountValue}%`,
        className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      };
    case "BOGO":
      return {
        label: "1+1",
        className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
      };
    case "FREE_DELIVERY":
      return {
        label: "Frais offerts",
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      };
    case "BUNDLE":
      return {
        label: "Pack",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      };
    case "AMOUNT":
    case "FIXED":
    default:
      return {
        label: `-${discountValue}\u20AC`,
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      };
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Actif",
        className:
          "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
      };
    case "PAUSED":
      return {
        label: "En pause",
        className:
          "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      };
    case "EXPIRED":
      return {
        label: "Expir\u00E9",
        className:
          "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
      };
    case "DRAFT":
    default:
      return {
        label: "Brouillon",
        className:
          "border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400",
      };
  }
}

function getAudienceLabel(audience: string): string {
  switch (audience) {
    case "ALL":
      return "Tous";
    case "NEW":
      return "Nouveaux";
    case "RETURNING":
      return "Fid\u00E8les";
    case "PRO":
      return "Pro";
    default:
      return audience;
  }
}

export function OffersList({
  offers,
  filter,
  onSelect,
}: {
  offers: Offer[];
  filter: string;
  onSelect?: (offer: Offer) => void;
}) {
  const filtered =
    filter === "all"
      ? offers
      : offers.filter((o) => o.payer === filter);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
          <Gift className="w-7 h-7 text-gray-300 dark:text-gray-600" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Aucune offre
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Cr\u00E9ez votre premi\u00E8re offre pour booster vos ventes
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((offer) => {
        const discount = getDiscountBadge(offer.type, offer.discountValue);
        const statusBadge = getStatusBadge(offer.status);
        const usesLabel =
          offer.maxUses !== null
            ? `${offer.currentUses}/${offer.maxUses}`
            : `${offer.currentUses} utilis\u00E9`;

        return (
          <button
            key={offer.id}
            type="button"
            onClick={() => onSelect?.(offer)}
            className="w-full bg-white dark:bg-[#141414] rounded-xl border border-gray-100 dark:border-white/10 px-5 py-4 flex items-center gap-4 hover:shadow-sm cursor-pointer text-left transition-shadow"
          >
            {/* Left icon */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                offer.payer === "KLIKGO"
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-amber-50 dark:bg-amber-900/20"
              }`}
            >
              {offer.payer === "KLIKGO" ? (
                <Crown className="w-5 h-5 text-red-500" />
              ) : (
                <Store className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              )}
            </div>

            {/* Content middle */}
            <div className="flex-1 min-w-0">
              {/* Line 1 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 dark:text-white truncate max-w-[180px]">
                  {offer.name}
                </span>
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${discount.className}`}
                >
                  {discount.label}
                </span>
                <span className="font-mono text-[11px] bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                  {offer.code}
                </span>
                {offer.shop && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    {offer.shop.name}
                  </span>
                )}
                {offer.minOrder > 0 && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                    Min {offer.minOrder}\u20AC
                  </span>
                )}
              </div>

              {/* Line 2 */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {getAudienceLabel(offer.audience)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(offer.startDate)} - {formatDate(offer.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5" />
                  {usesLabel}
                </span>
                <span className="text-gray-200 dark:text-gray-700">|</span>
                <span className="flex items-center gap-1.5">
                  <Tag
                    className={`w-3.5 h-3.5 ${
                      offer.diffBadge
                        ? "text-red-500"
                        : "text-gray-200 dark:text-gray-700"
                    }`}
                  />
                  <PanelTop
                    className={`w-3.5 h-3.5 ${
                      offer.diffBanner
                        ? "text-red-500"
                        : "text-gray-200 dark:text-gray-700"
                    }`}
                  />
                  <MousePointerClick
                    className={`w-3.5 h-3.5 ${
                      offer.diffPopup
                        ? "text-red-500"
                        : "text-gray-200 dark:text-gray-700"
                    }`}
                  />
                </span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-full ${statusBadge.className}`}
              >
                {statusBadge.label}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
