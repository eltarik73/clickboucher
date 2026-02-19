export const revalidate = 60; // ISR — rebuild every 60s

import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HeroButtons } from "./HeroButtons";
import { CartBadge } from "./CartBadge";
import { AuthButton } from "./AuthButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { StarRating } from "@/components/ui/StarRating";
import { getShopImage } from "@/lib/product-images";
import NearbyShops from "./NearbyShops";
import CalendarBanner from "@/components/landing/CalendarBanner";
import { SearchBar } from "@/components/search/SearchBar";
import { ActiveOrderBanner } from "@/components/order/ActiveOrderBanner";

const SHOP_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%23e5e7eb'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239ca3af'%3E🏪%3C/text%3E%3C/svg%3E";

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
    <div className="flex flex-col items-center mb-8">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl opacity-40 bg-[#DC2626] rounded-full scale-150" />
        <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 relative z-10">
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
      <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-white tracking-tight">
        Klik<span className="text-white">&</span>Go
      </h2>
      <p className="text-xs text-[#666] tracking-wider mt-1">by TkS26</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BUTCHER CARD - Premium design
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

function ButcherCard({ shop, index, isFavorite }: { shop: ShopData; index: number; isFavorite: boolean }) {
  const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const imgSrc = shop.imageUrl || getShopImage(index);

  const prepBadgeClasses =
    effectiveTime <= 15
      ? "bg-emerald-500/90 text-white"
      : effectiveTime <= 30
        ? "bg-amber-500/90 text-white"
        : "bg-red-500/90 text-white";

  return (
    <Link
      href={`/boutique/${shop.slug}`}
      className={`group bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
        (shop.status === "CLOSED" || shop.status === "VACATION") ? "opacity-60" : ""
      }`}
    >
      {/* Image with permanent gradient overlay */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={imgSrc}
          alt={shop.name}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          quality={75}
          onError={(e) => { (e.target as HTMLImageElement).src = SHOP_PLACEHOLDER; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {(shop.status === "OPEN" || shop.status === "BUSY") ? (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${prepBadgeClasses}`}>
              {effectiveTime <= 15 && (
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              )}
              {effectiveTime} min
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-600/90 text-white text-xs font-semibold rounded-lg">
              Ferme
            </span>
          )}
          {shop.status === "BUSY" && (
            <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-semibold rounded-lg">
              Occupe
            </span>
          )}
          {(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") && (
            <span className="px-2 py-1 bg-red-500/90 text-white text-xs font-semibold rounded-lg">
              Pause
            </span>
          )}
        </div>

        {/* Top-right: favorite + city */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <FavoriteButton shopId={shop.id} initialFavorite={isFavorite} size={22} />
          <span className="px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-sm text-gray-800 dark:text-white text-xs font-semibold rounded-lg">
            {shop.city}
          </span>
        </div>

        {/* Hover CTA */}
        {(shop.status === "OPEN" || shop.status === "BUSY") && (
          <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <span className="block w-full py-2.5 bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg text-center text-sm backdrop-blur-xl">
              Voir la boutique
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3
          className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#DC2626] dark:group-hover:text-[#DC2626] transition-colors font-display"
        >
          {shop.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {shop.address}, {shop.city}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg">
            <StarRating value={Math.round(shop.rating)} size="sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {shop.rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">({shop.ratingCount})</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

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
        <div className="relative z-10 max-w-6xl mx-auto px-5 py-16 sm:py-20 text-center">
          <HeroLogo />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez, recuperez.</span>
          </h1>
          <p className="mt-5 text-lg text-[#888] max-w-xl mx-auto">
            Zero file. Zero stress. <span className="text-white font-medium">100% frais.</span>
          </p>
          <HeroButtons />

          {/* Search bar */}
          <div className="mt-8 px-2">
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

        {/* Promos FIRST — horizontal scroll */}
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
