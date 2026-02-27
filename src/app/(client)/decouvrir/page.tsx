export const revalidate = 60; // ISR — rebuild every 60s

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HeroButtons } from "./HeroButtons";
import { CartBadge } from "./CartBadge";
import { AuthButton } from "./AuthButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import NearbyShops from "./NearbyShops";
import CalendarBanner from "@/components/landing/CalendarBanner";
import { SearchBar } from "@/components/search/SearchBar";
import { ActiveOrderBanner } from "@/components/order/ActiveOrderBanner";
import { ReorderCarousel } from "@/components/order/ReorderCarousel";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { KlikGoLogo } from "@/components/layout/KlikGoLogo";

export const metadata: Metadata = {
  title: "Découvrir les boucheries | Klik&Go",
  description:
    "Parcourez les boucheries halal de Chambéry, consultez les avis et commandez en click & collect. Retrait rapide avec QR code.",
  openGraph: {
    title: "Découvrir les boucheries | Klik&Go",
    description: "Parcourez les boucheries halal de Chambéry et commandez en ligne.",
  },
};

// ─────────────────────────────────────────────────────────────
// HERO LOGO (Centered, with glow)
// ─────────────────────────────────────────────────────────────
function HeroLogo() {
  return (
    <div className="flex flex-col items-center mb-4 sm:mb-8">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl opacity-20 dark:opacity-40 bg-[#DC2626] rounded-full scale-150" />
        <KlikLogo size={100} className="w-20 h-20 sm:w-[100px] sm:h-[100px] relative z-10" />
      </div>
      <h2 className="mt-3 sm:mt-5 text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
        Klik<span className="text-[#DC2626]">&amp;</span>Go
      </h2>
    </div>
  );
}

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

function PromoCard({ promo }: { promo: LivePromo }) {
  const discountLabel = promo.type === "PERCENT" && promo.valuePercent
    ? `-${promo.valuePercent}%`
    : promo.type === "FIXED" && promo.valueCents
    ? `-${(promo.valueCents / 100).toFixed(0)}\u20AC`
    : "Offre";

  // Platform promos (no shop) → link to /bons-plans instead of a non-existent shop page
  const href = promo.shopSlug ? `/boutique/${promo.shopSlug}` : "/bons-plans";

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
        <span className="text-white text-sm font-bold">{discountLabel}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-[#DC2626] dark:group-hover:text-[#DC2626] transition-colors">
          {promo.label}
        </h4>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{promo.shopName}</p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 px-2 py-1 rounded-full">
          {promo.type === "FREE_FEES" ? "Frais offerts" : discountLabel}
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — Server Component
// ─────────────────────────────────────────────────────────────
export default async function DecouvrirPage() {
  let shops: ShopData[] = [];
  let dbError = false;
  let favoriteIds: Set<string> = new Set();
  let livePromos: LivePromo[] = [];

  // 1. Auth (non-blocking — page works without login)
  let clerkId: string | null = null;
  try {
    const authResult = await auth();
    clerkId = authResult.userId;
  } catch (authErr) {
    void authErr; // Auth failed — non-blocking
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

    const promosPromise = prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      include: { shop: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    const [shopsResult, favResult, promosResult] = await Promise.all([shopsPromise, favPromise, promosPromise]);
    shops = shopsResult;
    if (favResult?.favoriteShops) {
      favoriteIds = new Set(favResult.favoriteShops.map((s) => s.id));
    }
    livePromos = promosResult.map((p) => ({
      id: p.id,
      label: p.label,
      type: p.type,
      valuePercent: p.valuePercent,
      valueCents: p.valueCents,
      shopName: p.shop?.name || "Klik&Go",
      shopSlug: p.shop?.slug || null,
    }));
  } catch (error) {
    dbError = true;
    void error;
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO WITH INTEGRATED HEADER - DARK */}
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
                Vous etes boucher ?
              </Link>
              <CartBadge />
              <ThemeToggle />
              <AuthButton />
            </div>
          </div>
        </header>

        {/* Hero content with CENTERED LOGO */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 py-8 sm:py-16 text-center">
          <HeroLogo />
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez. Récupérez. Savourez.</span>
          </h1>
          <p className="mt-3 sm:mt-5 text-base sm:text-lg text-gray-500 dark:text-[#888] max-w-xl mx-auto">
            Zero file. Zero stress. <span className="text-gray-900 dark:text-white font-medium">100% frais.</span>
          </p>
          <HeroButtons />

          {/* Search bar */}
          <div className="mt-5 sm:mt-8 px-2">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CALENDAR BANNER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-5 pt-10">
        <CalendarBanner />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* BUTCHERS SECTION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Active order banner */}
      <div className="max-w-6xl mx-auto pt-6">
        <ActiveOrderBanner />
      </div>

      <section id="butchers" className="max-w-6xl mx-auto px-5 py-14">
        {/* DB error warning */}
        {dbError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            Impossible de charger les boucheries. Veuillez rafraichir la page ou reessayer dans quelques instants.
          </div>
        )}

        {/* Reorder carousel — only for logged-in users with past orders */}
        <ReorderCarousel />

        {/* Promos — horizontal scroll (live from DB) */}
        {livePromos.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
                Offres du moment
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {livePromos.map((promo) => (
                <div key={promo.id} className="min-w-[280px] shrink-0">
                  <PromoCard promo={promo} />
                </div>
              ))}
            </div>
            <Link
              href="/bons-plans"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#DC2626] hover:underline mt-3"
            >
              Voir tous les bons plans &rarr;
            </Link>
          </div>
        )}

        {/* Geolocation-aware shop list */}
        <NearbyShops
          initialShops={shops.map((s) => ({ ...s, distance: null }))}
          favoriteIds={Array.from(favoriteIds)}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#ece8e3] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <KlikGoLogo />
            <p className="text-sm text-gray-400 dark:text-gray-500">&copy; 2026 Klik&amp;Go</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
