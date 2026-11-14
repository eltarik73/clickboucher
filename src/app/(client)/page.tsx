export const revalidate = 300; // ISR — régénération au plus toutes les 5 min (la liste est rafraîchie côté client par NearbyShops)

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { badgeLabelsByShop } from "@/lib/offer-badge-label";
import { listBadgeOffers, listPopupOffers } from "@/lib/public-offers";
import { countBonsPlans } from "@/lib/bons-plans";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PromoCarousel } from "@/components/landing/PromoCarousel";
import { HeroButtons } from "./decouvrir/HeroButtons";
import { CartBadge } from "./decouvrir/CartBadge";
import { AuthButton } from "./decouvrir/AuthButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import NearbyShops from "./decouvrir/NearbyShops";
import { SearchBar } from "@/components/search/SearchBar";
import { KlikLogo } from "@/components/ui/KlikLogo";
import { KlikGoLogo } from "@/components/layout/KlikGoLogo";
import dynamic from "next/dynamic";

const OrderTracker = dynamic(
  () => import("@/components/order/OrderTracker").then((m) => m.OrderTracker),
  { ssr: false }
);

const ReorderSection = dynamic(
  () => import("@/components/order/ReorderSection").then((m) => m.ReorderSection),
  { ssr: false }
);
const OfferPopup = dynamic(
  () => import("@/components/client/OfferPopup").then((m) => m.OfferPopup),
  { ssr: false }
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Click & Collect Boucherie Halal — Commandez en ligne",
  description:
    "Commandez en ligne chez votre boucherie halal de proximité. Retrait rapide en boutique à Chambéry, Grenoble, Lyon. Frais de service 0,99€ seulement.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Boucheries Halal près de chez vous — Click & Collect",
    description:
      "Trouvez votre boucherie halal et commandez en click & collect. Retrait rapide en boutique.",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Klik&Go — Click & Collect Boucherie Halal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boucheries Halal près de chez vous — Click & Collect",
    description: "Trouvez votre boucherie halal et commandez en click & collect.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: SITE_URL },
};

// ─────────────────────────────────────────────────────────────
// Shop type used by the page and NearbyShops
// ─────────────────────────────────────────────────────────────
type ShopData = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  imageUrl: string | null;
  prepTimeMin: number;
  busyMode: boolean;
  busyExtraMin: number;
  status: string;
  rating: number;
  ratingCount: number;
  activePromo: string | null;
  openingHours: Record<string, { open: string; close: string } | null> | null;
};

// ─────────────────────────────────────────────────────────────
// PROMO TYPES
// ─────────────────────────────────────────────────────────────
type LivePromo = {
  id: string;
  label: string;
  type: string;
  valuePercent: number | null;
  valueCents: number | null;
  shopName: string;
  shopSlug: string | null;
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — Server Component
// ─────────────────────────────────────────────────────────────
export default async function HomePage() {
  let shops: ShopData[] = [];
  let dbError = false;
  // Favorites are now hydrated client-side (NearbyShops) so the homepage can be ISR-cached by the CDN.
  const favoriteIds: Set<string> = new Set();
  let livePromos: LivePromo[] = [];
  let antiGaspiCount = 0;
  let flashSaleCount = 0;
  let promoCount = 0;
  let packCount = 0;
  let recipeCount = 0;
  let popupOffers: {
    id: string;
    name: string;
    code: string;
    type: string;
    discountValue: number;
    popupTitle: string | null;
    popupMessage: string | null;
    popupColor: string | null;
    popupFrequency: string | null;
    popupImageUrl: string | null;
  }[] = [];
  let latestRecipes: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    meatQuantity: string;
    totalTime: number;
  }[] = [];

  // 1. DB queries in parallel. Auth is handled client-side via NearbyShops (favorites hydrate after mount)
  //    so this page stays static/ISR-cacheable and Vercel CDN can serve it with `s-maxage=60`.
  try {
    const shopsPromise = prisma.shop.findMany({
      where: { visible: true },
      orderBy: { rating: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        city: true,
        imageUrl: true,
        prepTimeMin: true,
        busyMode: true,
        busyExtraMin: true,
        status: true,
        rating: true,
        ratingCount: true,
        openingHours: true,
      },
    });

    // Badges and popup: only public offers (audience ALL, diffused on that channel, uses left).
    const now = new Date();
    const offersPromise = listBadgeOffers(now, 6);
    const popupOffersPromise = listPopupOffers(now, 3);

    const latestRecipesPromise = prisma.recipe.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        imageUrl: true,
        meatQuantity: true,
        totalTime: true,
      },
      take: 4,
    });

    // Same filters as the bons-plans pages: the carousel never announces an empty list.
    const bonsPlansCountsPromise = countBonsPlans(now);
    const recipeCountPromise = prisma.recipe.count({
      where: { published: true },
    });

    // Run ALL DB queries in parallel — no auth() here (page is ISR-cached, favorites hydrate client-side)
    const [
      shopsResult,
      offersResult,
      popupOffersResult,
      bonsPlansCounts,
      rcCount,
      latestRecipesResult,
    ] = await Promise.all([
      shopsPromise,
      offersPromise,
      popupOffersPromise,
      bonsPlansCountsPromise,
      recipeCountPromise,
      latestRecipesPromise,
    ]);

    antiGaspiCount = bonsPlansCounts.antiGaspi;
    flashSaleCount = bonsPlansCounts.flashSale;
    promoCount = bonsPlansCounts.promo;
    packCount = bonsPlansCounts.pack;
    recipeCount = rcCount;
    latestRecipes = latestRecipesResult;
    livePromos = offersResult.map((o) => ({
      id: o.id,
      label: o.name,
      type: o.type,
      valuePercent: o.type === "PERCENT" ? o.discountValue : null,
      valueCents: o.type === "AMOUNT" ? Math.round(o.discountValue * 100) : null,
      shopName: o.shop?.name || "Klik&Go",
      shopSlug: o.shop?.slug || null,
    }));

    popupOffers = popupOffersResult.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      type: o.type,
      discountValue: o.discountValue,
      popupTitle: o.popupTitle,
      popupMessage: o.popupMessage,
      popupColor: o.popupColor,
      popupFrequency: o.popupFrequency,
      popupImageUrl: o.popupImageUrl,
    }));

    const shopPromoMap = badgeLabelsByShop(offersResult);

    // Attach promo label to shops + sort: shops with promos first
    shops = shopsResult.map((s) => ({
      ...s,
      openingHours: (s.openingHours as ShopData["openingHours"]) ?? null,
      activePromo: shopPromoMap.get(s.id) || null,
    }));
    shops.sort((a, b) => {
      const aHasPromo = a.activePromo ? 1 : 0;
      const bHasPromo = b.activePromo ? 1 : 0;
      if (bHasPromo !== aHasPromo) return bHasPromo - aHasPromo;
      return 0;
    });
  } catch (error) {
    // Sous ISR, une erreur avalée mettrait en cache une page d'accueil vide pour
    // toute la fenêtre. En production (build + runtime) on la relance : Next garde
    // la dernière bonne version, et un build sans base échoue au lieu de publier
    // une page vide. Le repli ci-dessous ne sert qu'en développement.
    if (process.env.NODE_ENV === "production") throw error;
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <h1 className="sr-only">
        Boucheries halal près de chez vous — Click &amp; Collect halal en ligne
      </h1>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO WITH INTEGRATED HEADER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="relative bg-white dark:bg-[#0A0A0A]">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #999 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header */}
        <header className="relative z-10 border-b border-gray-100 dark:border-white/5">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <KlikGoLogo />
            <div className="flex items-center gap-3">
              <Link
                href="/recettes"
                prefetch={false}
                className="hidden whitespace-nowrap text-xs font-medium text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400 sm:inline sm:text-sm"
              >
                Recettes
              </Link>
              <Link
                href="/bons-plans"
                className="hidden whitespace-nowrap text-xs font-medium text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400 sm:inline sm:text-sm"
              >
                Bons Plans
              </Link>
              <Link
                href="/espace-boucher"
                className="whitespace-nowrap text-xs font-medium text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400 sm:text-sm"
              >
                Vous êtes boucher ?
              </Link>
              <CartBadge />
              <ThemeToggle />
              <AuthButton />
            </div>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-8 text-center sm:py-16">
          {/* Logo with glow */}
          <div className="mb-4 flex flex-col items-center sm:mb-8">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#DC2626] opacity-20 blur-3xl dark:opacity-40" />
              <KlikLogo size={100} className="relative z-10 h-20 w-20 sm:h-[100px] sm:w-[100px]" />
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:mt-5 sm:text-5xl">
              Klik<span className="text-[#DC2626]">&amp;</span>Go
            </h2>
          </div>

          <p className="text-2xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez. Récupérez. Savourez.</span>
          </p>
          <p className="mx-auto mt-3 max-w-xl text-base text-gray-600 dark:text-[#999] sm:mt-5 sm:text-lg">
            Zero file. Zero stress.{" "}
            <span className="font-medium text-gray-900 dark:text-white">100% frais.</span>
          </p>
          <HeroButtons />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT — Uber Eats / Planity style */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="butchers" className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:py-10">
        {/* Order Tracker (active order) */}
        <OrderTracker />

        {/* Search bar */}
        <SearchBar />

        {/* Promo carousel (events + DB promos) */}
        <PromoCarousel
          livePromos={livePromos}
          antiGaspiCount={antiGaspiCount}
          flashSaleCount={flashSaleCount}
          promoCount={promoCount}
          packCount={packCount}
          recipeCount={recipeCount}
        />

        {/* Reorder last order */}
        <ReorderSection />

        {/* DB error */}
        {dbError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
            Impossible de charger les boucheries. Veuillez rafraîchir la page ou réessayer dans
            quelques instants.
          </div>
        )}

        {/* Nearby shops (open / closed split) */}
        <NearbyShops
          initialShops={shops.map((s) => ({ ...s, distance: null, activePromo: s.activePromo }))}
          favoriteIds={Array.from(favoriteIds)}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* RECIPES */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {latestRecipes.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              <span className="h-5 w-1 rounded-full bg-[#DC2626]" />
              Nos recettes
            </h2>
            <Link
              href="/recettes"
              prefetch={false}
              className="text-xs font-bold text-[#991B1B] underline-offset-2 transition hover:text-[#7F1D1D] hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {latestRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/recettes/${recipe.slug}`}
                className="min-w-[200px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#ece8e3] bg-white transition hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="relative h-28 overflow-hidden bg-gray-200 dark:bg-white/5">
                  {recipe.imageUrl ? (
                    <Image
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      fill
                      className="object-cover"
                      sizes="200px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      🍖
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    ⏱ {recipe.totalTime} min
                  </div>
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-bold text-gray-900 dark:text-white">
                    {recipe.title}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#DC2626]">
                    🥩 {recipe.meatQuantity}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SEO: CITY LINKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-[#DC2626]" />
          <h3 className="font-display text-lg font-bold text-gray-900 dark:text-white">
            Boucheries halal par ville
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { slug: "chambery", name: "Chambéry" },
            { slug: "aix-les-bains", name: "Aix-les-Bains" },
            { slug: "grenoble", name: "Grenoble" },
            { slug: "lyon", name: "Lyon" },
            { slug: "saint-etienne", name: "Saint-Étienne" },
            { slug: "annecy", name: "Annecy" },
          ].map((city) => (
            <Link
              key={city.slug}
              href={`/boucherie-halal/${city.slug}`}
              className="rounded-full border border-[#ece8e3] bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-[#DC2626] hover:text-[#DC2626] dark:border-white/[0.06] dark:bg-gray-800 dark:text-gray-300"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#ece8e3] bg-white py-10 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <KlikGoLogo />
            <nav className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <Link
                href="/recettes"
                prefetch={false}
                className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                Recettes
              </Link>
              <Link
                href="/mentions-legales"
                className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                Mentions légales
              </Link>
              <Link
                href="/cgv"
                className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                CGV
              </Link>
              <Link
                href="/politique-de-confidentialite"
                className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                Confidentialité
              </Link>
              <a
                href="mailto:contact@klikandgo.app"
                className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              >
                Contact
              </a>
            </nav>
          </div>
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Klik&amp;Go
          </p>
        </div>
      </footer>

      {popupOffers.length > 0 && <OfferPopup offers={popupOffers} />}
    </div>
  );
}
