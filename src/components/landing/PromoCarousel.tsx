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
  promoCount?: number;
  packCount?: number;
  recipeCount?: number;
}

export function PromoCarousel({
  livePromos,
  antiGaspiCount = 0,
  flashSaleCount = 0,
  promoCount = 0,
  packCount = 0,
  recipeCount = 0,
}: Props) {
  void livePromos;

  // Build dynamic vignettes (priority order) — only show vignettes that link to pages with content
  const vignettes: Vignette[] = [];

  if (antiGaspiCount > 0) {
    vignettes.push({
      id: "anti-gaspi",
      emoji: "\uD83C\uDF3F",
      title: "Anti-Gaspi",
      subtitle: `${antiGaspiCount} produit${antiGaspiCount > 1 ? "s" : ""} à prix réduit`,
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
      subtitle: `${flashSaleCount} offre${flashSaleCount > 1 ? "s" : ""} limitée${flashSaleCount > 1 ? "s" : ""}`,
      bgClass: "bg-gradient-to-br from-orange-500 to-red-600",
      accentClass: "text-orange-200",
      href: "/bons-plans/vente-flash",
    });
  }

  // Static vignettes — only shown when their target page has content
  if (promoCount > 0) {
    vignettes.push({
      id: "bienvenue",
      emoji: "\uD83D\uDD25",
      title: "-10%",
      subtitle: "1ere commande",
      bgClass: "bg-gradient-to-br from-red-600 to-red-800",
      accentClass: "text-amber-100",
      href: "/bons-plans/promos",
    });
  }

  if (packCount > 0 && vignettes.length < 3) {
    vignettes.push({
      id: "famille",
      emoji: "\uD83E\uDD69",
      title: "Pack Famille",
      subtitle: "5kg prix réduit",
      bgClass: "bg-gradient-to-br from-emerald-800 to-emerald-900",
      accentClass: "text-emerald-300",
      href: "/bons-plans/packs",
    });
  }

  if (recipeCount > 0 && vignettes.length < 3) {
    vignettes.push({
      id: "recettes",
      emoji: "\uD83C\uDF73",
      title: "Recettes",
      subtitle: `${recipeCount} recette${recipeCount > 1 ? "s" : ""}`,
      bgClass: "bg-gradient-to-br from-amber-600 to-orange-700",
      accentClass: "text-amber-200",
      href: "/recettes",
    });
  }

  // Always show the welcome vignette as fallback
  if (vignettes.length < 3 && !vignettes.some(v => v.id === "bienvenue")) {
    vignettes.push({
      id: "bienvenue",
      emoji: "\uD83D\uDD25",
      title: "Bienvenue",
      subtitle: "Commandez en 2 min",
      bgClass: "bg-gradient-to-br from-red-600 to-red-800",
      accentClass: "text-amber-100",
      href: "/",
    });
  }

  // If still not enough, add a generic fallback
  if (vignettes.length < 3) {
    vignettes.push({
      id: "decouvrir",
      emoji: "\uD83E\uDD69",
      title: "Nos boucheries",
      subtitle: "Viande halal fraîche",
      bgClass: "bg-gradient-to-br from-slate-700 to-slate-900",
      accentClass: "text-gray-300",
      href: "/",
    });
  }

  // Only keep 3 max
  const display = vignettes.slice(0, 3);

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 bg-red-600 rounded-full" />
        <h2 className="font-bold text-base text-gray-900 dark:text-white">Offres du moment</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {display.map((p) => (
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
              <div className={`${p.accentClass} text-xs font-medium`}>{p.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
