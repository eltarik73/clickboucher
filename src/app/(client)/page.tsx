export const revalidate = 60; // ISR — rebuild every 60s

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
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

const OrderTracker = dynamic(() => import("@/components/order/OrderTracker").then(m => m.OrderTracker), { ssr: false });
const QuickCategories = dynamic(() => import("@/components/landing/QuickCategories").then(m => m.QuickCategories), { ssr: false });
const ReorderSection = dynamic(() => import("@/components/order/ReorderSection").then(m => m.ReorderSection), { ssr: false });
const OfferPopup = dynamic(() => import("@/components/client/OfferPopup").then(m => m.OfferPopup), { ssr: false });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Klik&Go — Click & Collect Boucherie Halal | Commandez en ligne",
  description:
    "Commandez en ligne chez votre boucherie halal de proximité. Retrait rapide en boutique à Chambéry, Grenoble, Lyon. Frais de service 0,99€ seulement.",
  openGraph: {
    title: "Boucheries Halal près de chez vous — Click & Collect | Klik&Go",
    description: "Trouvez votre boucherie halal et commandez en click & collect. Retrait rapide en boutique.",
    url: SITE_URL,
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
  let favoriteIds: Set<string> = new Set();
  let livePromos: LivePromo[] = [];
  let popupOffers: { id: string; name: string; code: string; type: string; discountValue: number; popupTitle: string | null; popupMessage: string | null; popupColor: string | null; popupFrequency: string | null; popupImageUrl: string | null }[] = [];

  // 1. Auth (non-blocking — page works without login)
  let clerkId: string | null = null;
  try {
    const authResult = await auth();
    clerkId = authResult.userId;
  } catch (authErr) {
    void authErr;
  }

  // 2. Fetch shops + favorites in parallel
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
      },
    });

    const favPromise = clerkId
      ? prisma.user.findUnique({
          where: { clerkId },
          select: { favoriteShops: { select: { id: true } } },
        })
      : Promise.resolve(null);

    const offersPromise = prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gt: new Date() },
        diffBadge: true,
      },
      include: { shop: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    const popupOffersPromise = prisma.offer.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gt: new Date() },
        diffPopup: true,
      },
      select: {
        id: true, name: true, code: true, type: true, discountValue: true,
        popupTitle: true, popupMessage: true, popupColor: true, popupFrequency: true, popupImageUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const [shopsResult, favResult, offersResult, popupOffersResult] = await Promise.all([shopsPromise, favPromise, offersPromise, popupOffersPromise]);

    if (favResult?.favoriteShops) {
      favoriteIds = new Set(favResult.favoriteShops.map((s) => s.id));
    }
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

    // Build shopId → promo label map for badge display
    const shopPromoMap = new Map<string, string>();
    for (const o of offersResult) {
      if (o.shopId && !shopPromoMap.has(o.shopId)) {
        const shortLabel = o.type === "FREE_DELIVERY" ? "Frais offerts"
          : o.type === "PERCENT" ? `-${o.discountValue}%`
          : o.type === "AMOUNT" ? `-${o.discountValue}€`
          : o.type === "BOGO" ? "1+1 offert"
          : o.type === "BUNDLE" ? "Pack"
          : o.name;
        shopPromoMap.set(o.shopId, shortLabel);
      }
    }

    // Attach promo label to shops + sort: shops with promos first
    shops = shopsResult.map((s) => ({
      ...s,
      activePromo: shopPromoMap.get(s.id) || null,
    }));
    shops.sort((a, b) => {
      const aHasPromo = a.activePromo ? 1 : 0;
      const bHasPromo = b.activePromo ? 1 : 0;
      if (bHasPromo !== aHasPromo) return bHasPromo - aHasPromo;
      return 0;
    });
  } catch (error) {
    dbError = true;
    void error;
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
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
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <KlikGoLogo />
            <div className="flex items-center gap-3">
              <Link
                href="/espace-boucher"
                className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] transition"
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
        <div className="relative z-10 max-w-6xl mx-auto px-5 py-8 sm:py-16 text-center">
          {/* Logo with glow */}
          <div className="flex flex-col items-center mb-4 sm:mb-8">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl opacity-20 dark:opacity-40 bg-[#DC2626] rounded-full scale-150" />
              <KlikLogo size={100} className="w-20 h-20 sm:w-[100px] sm:h-[100px] relative z-10" />
            </div>
            <h2 className="mt-3 sm:mt-5 text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
              Klik<span className="text-[#DC2626]">&amp;</span>Go
            </h2>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez. Récupérez. Savourez.</span>
          </h1>
          <p className="mt-3 sm:mt-5 text-base sm:text-lg text-gray-600 dark:text-[#999] max-w-xl mx-auto">
            Zero file. Zero stress. <span className="text-gray-900 dark:text-white font-medium">100% frais.</span>
          </p>
          <HeroButtons />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT — Uber Eats / Planity style */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="butchers" className="max-w-6xl mx-auto px-5 py-6 sm:py-10 space-y-5">
        {/* Order Tracker (active order) */}
        <OrderTracker />

        {/* Search bar */}
        <SearchBar />

        {/* Quick categories chips */}
        <QuickCategories />

        {/* Promo carousel (events + DB promos) */}
        <PromoCarousel livePromos={livePromos} />

        {/* Reorder last order */}
        <ReorderSection />

        {/* DB error */}
        {dbError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            Impossible de charger les boucheries. Veuillez rafraîchir la page ou réessayer dans quelques instants.
          </div>
        )}

        {/* Nearby shops (open / closed split) */}
        <NearbyShops
          initialShops={shops.map((s) => ({ ...s, distance: null, activePromo: s.activePromo }))}
          favoriteIds={Array.from(favoriteIds)}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SEO: CITY LINKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
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
              className="px-4 py-2 bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-full text-sm text-gray-700 dark:text-gray-300 hover:border-[#DC2626] hover:text-[#DC2626] transition"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#ece8e3] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <KlikGoLogo />
            <p className="text-sm text-gray-500 dark:text-gray-400">&copy; 2026 Klik&amp;Go</p>
          </div>
        </div>
      </footer>

      {popupOffers.length > 0 && <OfferPopup offers={popupOffers} />}
    </div>
  );
}
