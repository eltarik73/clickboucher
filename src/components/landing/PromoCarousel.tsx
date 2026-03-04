// src/components/landing/PromoCarousel.tsx — 3-column promo grid (Server Component)

import Link from "next/link";

const PROMOS = [
  {
    id: "ramadan",
    emoji: "🌙",
    title: "Ramadan",
    subtitle: "Préparez l'Iftar",
    bgClass: "bg-gradient-to-br from-slate-800 to-slate-900",
    accentClass: "text-amber-400",
  },
  {
    id: "bienvenue",
    emoji: "🔥",
    title: "-10%",
    subtitle: "1ère commande",
    bgClass: "bg-gradient-to-br from-red-600 to-red-800",
    accentClass: "text-amber-100",
  },
  {
    id: "famille",
    emoji: "🥩",
    title: "Pack Famille",
    subtitle: "5kg prix réduit",
    bgClass: "bg-gradient-to-br from-emerald-800 to-emerald-900",
    accentClass: "text-emerald-300",
  },
];

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
  void livePromos; // DB promos handled via shop badges — grid shows static promos

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 bg-red-600 rounded-full" />
        <h2 className="font-bold text-base text-gray-900 dark:text-white">Offres du moment</h2>
      </div>

      {/* 3-column grid — no scroll */}
      <div className="grid grid-cols-3 gap-2.5">
        {PROMOS.map((p) => (
          <Link
            key={p.id}
            href="/#butchers"
            className={`${p.bgClass} rounded-2xl p-4 relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform min-h-[120px] flex flex-col justify-end`}
          >
            {/* Glass overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.15] via-white/[0.03] to-transparent rounded-2xl pointer-events-none" />

            {/* Top light line */}
            <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

            {/* Decorative emoji */}
            <span className="absolute -bottom-1.5 -right-1 text-5xl opacity-[0.08] select-none pointer-events-none">{p.emoji}</span>

            {/* Content */}
            <div className="relative z-10">
              <div className="text-2xl mb-2.5">{p.emoji}</div>
              <div className="text-white font-extrabold text-base leading-tight mb-0.5">{p.title}</div>
              <div className={`${p.accentClass} text-[11px] font-medium`}>{p.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
