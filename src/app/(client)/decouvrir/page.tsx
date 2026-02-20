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
// LOGO COMPONENT (Header)
// ─────────────────────────────────────────────────────────────
function KlikGoLogo({ light = false }: { light?: boolean }) {
  const textColor = light ? "text-white" : "text-[#1A1A1A] dark:text-white";

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
        <span className="text-white font-bold text-lg">K</span>
      </div>
      <div className="flex items-baseline gap-0">
        <span className={`text-xl font-bold ${textColor} tracking-tight`}>Klik</span>
        <span className={`text-xl font-bold ${textColor}`}>&</span>
        <span className={`text-xl font-bold ${textColor} tracking-tight`}>Go</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO LOGO (Centered, with glow)
// ─────────────────────────────────────────────────────────────
function HeroLogo() {
  return (
    <div className="flex flex-col items-center mb-4 sm:mb-8">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl opacity-40 bg-[#DC2626] rounded-full scale-150" />
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-20 sm:h-20 relative z-10">
          <defs>
            <linearGradient id="heroLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a83320" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#heroLogoGradient)" />
          <path
            d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
            fill="white"
          />
          <g className="animate-pulse">
            <line x1="75" y1="35" x2="88" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <line x1="78" y1="45" x2="93" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="75" y1="55" x2="86" y2="55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
      </div>
      <h2 className="mt-2 sm:mt-4 text-xl sm:text-2xl font-bold text-white tracking-tight">
        Klik<span className="text-white">&</span>Go
      </h2>
      <p className="text-[10px] sm:text-xs text-[#666] tracking-wider mt-0.5">by TkS26</p>
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
// PROMOS (hardcoded for now)
// ─────────────────────────────────────────────────────────────
const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "20", price: 10.32, oldPrice: 12.90, shop: "El Fathe", shopSlug: "el-fathe" },
  { id: "p2", title: "Entrecote premium", discount: "15", price: 32.30, oldPrice: 38.00, shop: "Elba Market", shopSlug: "elba-market" },
  { id: "p3", title: "Brochettes BBQ", discount: "10", price: 19.80, oldPrice: 22.00, shop: "Boucherie de Joppet", shopSlug: "boucherie-joppet" },
];

function PromoCard({ promo }: { promo: (typeof PROMOS)[0] }) {
  return (
    <Link
      href={`/boutique/${promo.shopSlug}`}
      className="flex items-center gap-4 p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-[#ece8e3] dark:border-white/[0.06] hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
        <span className="text-white text-sm font-bold">-{promo.discount}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-[#DC2626] dark:group-hover:text-[#DC2626] transition-colors">
          {promo.title}
        </h4>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{promo.shop}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900 dark:text-white">
          {promo.price.toFixed(2).replace(".", ",")} &euro;
          <span className="text-xs font-normal text-gray-400">/kg</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 line-through">
          {promo.oldPrice.toFixed(2).replace(".", ",")} &euro;
        </p>
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

    const [shopsResult, favResult] = await Promise.all([shopsPromise, favPromise]);
    shops = shopsResult;
    if (favResult?.favoriteShops) {
      favoriteIds = new Set(favResult.favoriteShops.map((s) => s.id));
    }
  } catch (error) {
    dbError = true;
    void error;
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO WITH INTEGRATED HEADER - DARK */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0A0A0A]">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header */}
        <header className="relative z-10 border-b border-white/5">
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <KlikGoLogo light />
            <div className="flex items-center gap-3">
              <Link
                href="/espace-boucher"
                className="hidden sm:inline text-sm text-gray-500 hover:text-[#DC2626] transition"
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
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez, recuperez.</span>
          </h1>
          <p className="mt-3 sm:mt-5 text-base sm:text-lg text-[#888] max-w-xl mx-auto">
            Zero file. Zero stress. <span className="text-white font-medium">100% frais.</span>
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

        {/* Promos — horizontal scroll */}
        {PROMOS.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#DC2626] rounded-full" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
                Offres du moment
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {PROMOS.map((promo) => (
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
            <p className="text-sm text-gray-400 dark:text-gray-500">2026 Klik&Go — Propulse par TkS26</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
