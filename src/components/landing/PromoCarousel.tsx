// src/components/landing/PromoCarousel.tsx — Dynamic + static 3-column promo grid (Server Component)

import Link from "next/link";

type Vignette = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  bgClass: string;
  accentClass: string;
  href: string;
};

const STATIC_VIGNETTES: Vignette[] = [
  {
    id: "ramadan",
    emoji: "\uD83C\uDF19",
    title: "Ramadan",
    subtitle: "Preparez l'Iftar",
    bgClass: "bg-gradient-to-br from-slate-800 to-slate-900",
    accentClass: "text-amber-400",
    href: "/bons-plans/ramadan",
  },
  {
    id: "bienvenue",
    emoji: "\uD83D\uDD25",
    title: "-10%",
    subtitle: "1ere commande",
    bgClass: "bg-gradient-to-br from-red-600 to-red-800",
    accentClass: "text-amber-100",
    href: "/bons-plans/promos",
  },
  {
    id: "famille",
    emoji: "\uD83E\uDD69",
    title: "Pack Famille",
    subtitle: "5kg prix reduit",
    bgClass: "bg-gradient-to-br from-emerald-800 to-emerald-900",
    accentClass: "text-emerald-300",
    href: "/bons-plans/packs",
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

interface Props {
  livePromos: LivePromo[];
  antiGaspiCount?: number;
  flashSaleCount?: number;
}

export function PromoCarousel({ livePromos, antiGaspiCount = 0, flashSaleCount = 0 }: Props) {
  void livePromos;

  // Build dynamic vignettes (priority order)
  const vignettes: Vignette[] = [];

  if (antiGaspiCount > 0) {
    vignettes.push({
      id: "anti-gaspi",
      emoji: "\uD83C\uDF3F",
      title: "Anti-Gaspi",
      subtitle: `${antiGaspiCount} produit${antiGaspiCount > 1 ? "s" : ""} a prix reduit`,
      bgClass: "bg-gradient-to-br from-emerald-600 to-emerald-800",
      accentClass: "text-emerald-200",
      href: "/bons-plans/anti-gaspi",
    });
  }

  if (flashSaleCount > 0) {
    vignettes.push({
      id: "flash",
      emoji: "\u26A1",
      title: "Vente Flash",
      subtitle: `${flashSaleCount} offre${flashSaleCount > 1 ? "s" : ""} limitee${flashSaleCount > 1 ? "s" : ""}`,
      bgClass: "bg-gradient-to-br from-orange-500 to-red-600",
      accentClass: "text-orange-200",
      href: "/bons-plans/vente-flash",
    });
  }

  // Fill with static vignettes up to 3
  for (const sv of STATIC_VIGNETTES) {
    if (vignettes.length >= 3) break;
    if (!vignettes.some(v => v.id === sv.id)) {
      vignettes.push(sv);
    }
  }

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 bg-red-600 rounded-full" />
        <h2 className="font-bold text-base text-gray-900 dark:text-white">Offres du moment</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {vignettes.map((p) => (
          <Link
            key={p.id}
            href={p.href}
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
