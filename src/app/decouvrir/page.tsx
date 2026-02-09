import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HeroButtons } from "./HeroButtons";
import { CartBadge } from "./CartBadge";

// ─────────────────────────────────────────────────────────────
// LOGO COMPONENT (Header)
// ─────────────────────────────────────────────────────────────
function KlikGoLogo({ light = false }: { light?: boolean }) {
  const textColor = light ? "text-white" : "text-[#1A1A1A]";

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
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
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#B91C1C" />
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
// PREP TIME HELPERS
// ─────────────────────────────────────────────────────────────
function prepTimeColor(minutes: number) {
  if (minutes <= 15) return "text-emerald-400";
  if (minutes <= 30) return "text-amber-400";
  return "text-red-400";
}

function prepTimeBg(minutes: number) {
  if (minutes <= 15) return "bg-emerald-400";
  if (minutes <= 30) return "bg-amber-400";
  return "bg-red-400";
}

// ─────────────────────────────────────────────────────────────
// BUTCHER CARD - Real data from Prisma
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
  paused: boolean;
  rating: number;
  ratingCount: number;
};

function ButcherCard({ shop }: { shop: ShopData }) {
  const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const imgSrc = shop.imageUrl || "/images/boucherie-hero.webp";

  return (
    <Link href={`/boutique/${shop.slug}`} className="group">
      {/* Image container */}
      <div className="relative h-52 rounded-2xl overflow-hidden mb-3">
        <Image
          src={imgSrc}
          alt={shop.name}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top-left: prep time badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
            {effectiveTime <= 15 && (
              <div className={`w-2 h-2 ${prepTimeBg(effectiveTime)} rounded-full animate-pulse`} />
            )}
            <span className={`text-xs font-medium ${prepTimeColor(effectiveTime)}`}>
              {effectiveTime} min
            </span>
          </div>

          {shop.busyMode && (
            <span className="px-2 py-1.5 bg-amber-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-lg">
              Mode occupe
            </span>
          )}

          {shop.paused && (
            <span className="px-2 py-1.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-lg">
              Pause
            </span>
          )}
        </div>

        {/* Top-right: city badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1.5 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-semibold rounded-lg shadow-sm">
            {shop.city}
          </span>
        </div>

        {/* Quick action on hover */}
        <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <span className="block w-full py-3 bg-white text-gray-900 font-semibold rounded-xl shadow-lg text-center">
            J&apos;y vais
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-[#DC2626] transition-colors">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md shrink-0">
              <span className="text-xs font-semibold text-gray-900">
                {shop.rating.toFixed(1)}
              </span>
              <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-gray-500">({shop.ratingCount})</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{shop.address}, {shop.city}</p>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// PROMOS (hardcoded for now)
// ─────────────────────────────────────────────────────────────
const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "20", price: 10.32, oldPrice: 12.90, shop: "Dupont", shopId: "1" },
  { id: "p2", title: "Entrecote premium", discount: "15", price: 32.30, oldPrice: 38.00, shop: "L'Artisan", shopId: "3" },
  { id: "p3", title: "Brochettes BBQ", discount: "10", price: 19.80, oldPrice: 22.00, shop: "Maison", shopId: "2" },
];

function PromoCard({ promo }: { promo: (typeof PROMOS)[0] }) {
  return (
    <Link
      href={`/boutique/${promo.shopId}`}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
        <span className="text-white text-sm font-bold">-{promo.discount}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 truncate group-hover:text-[#DC2626] transition-colors">
          {promo.title}
        </h4>
        <p className="text-xs text-gray-400 mt-0.5">{promo.shop}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900">
          {promo.price.toFixed(2).replace(".", ",")} €
          <span className="text-xs font-normal text-gray-400">/kg</span>
        </p>
        <p className="text-xs text-gray-400 line-through">
          {promo.oldPrice.toFixed(2).replace(".", ",")} €
        </p>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — Server Component
// ─────────────────────────────────────────────────────────────
export default async function DecouvrirPage() {
  const shops = await prisma.shop.findMany({
    where: { isOpen: true },
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
      paused: true,
      rating: true,
      ratingCount: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
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
              <CartBadge />
              <Link
                href="/sign-in"
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10"
              >
                Se connecter
              </Link>
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* BUTCHERS SECTION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="butchers" className="max-w-6xl mx-auto px-5 py-14">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Boucheries disponibles</h2>
            <p className="text-gray-500 mt-1">
              {shops.length > 0
                ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""} pres de chez vous`
                : "Aucune boucherie disponible pour le moment"}
            </p>
          </div>
        </div>

        {/* Grid - 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {shops.map((shop) => (
            <ButcherCard key={shop.id} shop={shop} />
          ))}
        </div>

        {/* Promos section */}
        <div className="mt-14">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">Offres du moment</h3>
            <button className="text-sm text-[#DC2626] font-medium hover:underline">
              Voir tout
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROMOS.map((promo) => (
              <PromoCard key={promo.id} promo={promo} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <KlikGoLogo />
            <p className="text-sm text-gray-400">2026 Klik&Go — Propulse par TkS26</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
