// src/components/landing/PromoCarousel.tsx — Horizontal promo cards (Server Component)

import Link from "next/link";
import { Tag } from "lucide-react";

// Religious events — same as old CalendarBanner
const EVENTS = [
  { name: "Ramadan", date: "2025-03-01", endDate: "2025-03-30", emoji: "🌙", type: "ramadan", link: "Préparez l'Iftar" },
  { name: "Aïd el-Fitr", date: "2025-03-31", emoji: "🎉", type: "aid", link: "Commandez pour la fête" },
  { name: "Aïd el-Adha", date: "2025-06-07", emoji: "🐑", type: "aid-adha", link: "Commandez votre mouton" },
  { name: "Ramadan", date: "2026-02-18", endDate: "2026-03-19", emoji: "🌙", type: "ramadan", link: "Préparez l'Iftar" },
  { name: "Aïd el-Fitr", date: "2026-03-20", emoji: "🎉", type: "aid", link: "Commandez pour la fête" },
  { name: "Aïd el-Adha", date: "2026-05-27", emoji: "🐑", type: "aid-adha", link: "Commandez votre mouton" },
];

function getUpcomingEvent() {
  const now = Date.now();
  return EVENTS.find((e) => {
    const days = Math.ceil((new Date(e.date).getTime() - now) / 86_400_000);
    const endDays = e.endDate
      ? Math.ceil((new Date(e.endDate).getTime() - now) / 86_400_000)
      : days;
    return days <= 21 && endDays >= 0;
  }) || null;
}

type LivePromo = {
  id: string;
  label: string;
  type: string;
  valuePercent: number | null;
  valueCents: number | null;
  shopName: string;
  shopSlug: string | null;
};

const EVENT_GRADIENTS: Record<string, string> = {
  ramadan: "from-slate-800 to-slate-900",
  aid: "from-amber-700 to-orange-800",
  "aid-adha": "from-emerald-800 to-teal-900",
};

const EVENT_ACCENTS: Record<string, string> = {
  ramadan: "text-amber-400",
  aid: "text-amber-200",
  "aid-adha": "text-emerald-300",
};

export function PromoCarousel({ livePromos }: { livePromos: LivePromo[] }) {
  const event = getUpcomingEvent();
  if (!event && livePromos.length === 0) return null;

  const eventDays = event
    ? Math.ceil((new Date(event.date).getTime() - Date.now()) / 86_400_000)
    : 0;
  const isOngoing = eventDays <= 0;

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white font-display">
          Offres du moment
        </h2>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Event card */}
        {event && (
          <Link
            href="/#butchers"
            className={`min-w-[260px] shrink-0 bg-gradient-to-br ${EVENT_GRADIENTS[event.type] || "from-slate-800 to-slate-900"} rounded-2xl p-5 relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-transform`}
          >
            <span className="absolute -bottom-3 -right-2 text-6xl opacity-[0.08] select-none">
              {event.emoji}
            </span>
            <div className="relative z-10">
              <p className={`text-xs font-medium uppercase tracking-wider ${EVENT_ACCENTS[event.type] || "text-amber-400"} opacity-80`}>
                {isOngoing ? "En cours" : `Dans ${eventDays} jour${eventDays > 1 ? "s" : ""}`}
              </p>
              <h3 className="text-xl font-bold text-white mt-1">
                {event.emoji} {event.name}
              </h3>
              <p className="text-sm text-white/80 mt-1">{event.link}</p>
              <span className="inline-block mt-3 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold text-white transition-colors">
                Voir les boucheries
              </span>
            </div>
          </Link>
        )}

        {/* DB promo cards */}
        {livePromos.map((promo) => {
          const discountLabel =
            promo.type === "PERCENT" && promo.valuePercent
              ? `-${promo.valuePercent}%`
              : promo.type === "AMOUNT" && promo.valueCents
                ? `-${(promo.valueCents / 100).toFixed(0)}€`
                : promo.type === "FREE_DELIVERY"
                  ? "Frais offerts"
                  : promo.type === "BOGO"
                    ? "1+1 offert"
                    : promo.type === "BUNDLE"
                      ? "Pack"
                      : "Offre";

          const href = promo.shopSlug ? `/boutique/${promo.shopSlug}` : "/bons-plans";

          return (
            <Link
              key={promo.id}
              href={href}
              className="min-w-[260px] shrink-0 bg-white dark:bg-white/[0.03] rounded-2xl border border-[#ece8e3] dark:border-white/[0.06] p-4 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">{discountLabel}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-[#DC2626] transition-colors">
                    {promo.label}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {promo.shopName}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Tag size={12} />
                  {discountLabel}
                </span>
                <span className="text-xs font-semibold text-[#DC2626]">
                  En profiter →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
