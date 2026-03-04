// src/components/landing/PromoCarousel.tsx — Compact horizontal promo cards (Server Component)

import Link from "next/link";

// Religious events
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

// Static promo cards (always visible)
const STATIC_PROMOS = [
  {
    emoji: "🔥",
    title: "-10%",
    subtitle: "1ère commande",
    bgClass: "bg-gradient-to-br from-red-600 to-red-800",
    accentClass: "text-amber-100",
  },
  {
    emoji: "🥩",
    title: "Pack Famille",
    subtitle: "5kg à prix réduit",
    bgClass: "bg-gradient-to-br from-emerald-800 to-emerald-900",
    accentClass: "text-emerald-300",
  },
  {
    emoji: "⚡",
    title: "Express",
    subtitle: "Prêt en 15 min",
    bgClass: "bg-gradient-to-br from-violet-600 to-violet-800",
    accentClass: "text-violet-200",
  },
  {
    emoji: "🎁",
    title: "Parrainage",
    subtitle: "5€ offerts",
    bgClass: "bg-gradient-to-br from-orange-600 to-orange-800",
    accentClass: "text-orange-200",
  },
];

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

type LivePromo = {
  id: string;
  label: string;
  type: string;
  valuePercent: number | null;
  valueCents: number | null;
  shopName: string;
  shopSlug: string | null;
};

export function PromoCarousel({ livePromos }: { livePromos: LivePromo[] }) {
  const event = getUpcomingEvent();

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white font-display">
          Offres du moment
        </h2>
      </div>

      <div
        className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {/* Event card (Ramadan, Aïd, etc.) */}
        {event && (
          <Link
            href="/#butchers"
            className={`min-w-[140px] max-w-[140px] bg-gradient-to-br ${EVENT_GRADIENTS[event.type] || "from-slate-800 to-slate-900"} rounded-[14px] p-4 snap-start flex-shrink-0 relative overflow-hidden cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-transform`}
          >
            <span className="absolute -bottom-2 -right-1.5 text-5xl opacity-[0.08] select-none">
              {event.emoji}
            </span>
            <div className="text-xl mb-2.5">{event.emoji}</div>
            <div className="text-white font-extrabold text-base leading-tight mb-0.5">
              {event.name}
            </div>
            <div className={`${EVENT_ACCENTS[event.type] || "text-amber-400"} text-xs font-medium opacity-90`}>
              {event.link}
            </div>
          </Link>
        )}

        {/* Static promo cards */}
        {STATIC_PROMOS.map((p) => (
          <Link
            key={p.title}
            href="/#butchers"
            className={`min-w-[140px] max-w-[140px] ${p.bgClass} rounded-[14px] p-4 snap-start flex-shrink-0 relative overflow-hidden cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-transform`}
          >
            <span className="absolute -bottom-2 -right-1.5 text-5xl opacity-[0.08] select-none">{p.emoji}</span>
            <div className="text-xl mb-2.5">{p.emoji}</div>
            <div className="text-white font-extrabold text-base leading-tight mb-0.5">{p.title}</div>
            <div className={`${p.accentClass} text-xs font-medium opacity-90`}>{p.subtitle}</div>
          </Link>
        ))}

        {/* DB promo cards */}
        {livePromos.map((promo) => {
          const discountLabel =
            promo.type === "PERCENT" && promo.valuePercent
              ? `-${promo.valuePercent}%`
              : promo.type === "AMOUNT" && promo.valueCents
                ? `-${(promo.valueCents / 100).toFixed(0)}€`
                : promo.type === "FREE_DELIVERY"
                  ? "Gratuit"
                  : promo.type === "BOGO"
                    ? "1+1"
                    : promo.type === "BUNDLE"
                      ? "Pack"
                      : "Offre";

          const href = promo.shopSlug ? `/boutique/${promo.shopSlug}` : "/bons-plans";

          return (
            <Link
              key={promo.id}
              href={href}
              className="min-w-[140px] max-w-[140px] bg-gradient-to-br from-[#DC2626] to-red-800 rounded-[14px] p-4 snap-start flex-shrink-0 relative overflow-hidden cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-transform"
            >
              <span className="absolute -bottom-2 -right-1.5 text-5xl opacity-[0.08] select-none">🏷️</span>
              <div className="text-xl mb-2.5">🏷️</div>
              <div className="text-white font-extrabold text-base leading-tight mb-0.5">{discountLabel}</div>
              <div className="text-red-200 text-xs font-medium opacity-90 truncate">{promo.shopName}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
