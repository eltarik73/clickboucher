"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { useCart } from "@/lib/hooks/use-cart";

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
        {/* Glow effect */}
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
          {/* Speed lines */}
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
// IMAGES & DATA
// ─────────────────────────────────────────────────────────────
const BUTCHER_IMAGES = [
  "/images/boucherie-hero.webp",
  "/images/boucherie-hero.webp",
  "/images/boucherie-hero.webp",
  "/images/boucherie-hero.webp",
];

const BUTCHERS = [
  { id: "1", name: "Boucherie Dupont", rating: 4.8, reviews: 127, distance: "800m", time: "15-20 min", isOpen: true, isExpress: true, specialty: "Halal", image: BUTCHER_IMAGES[0] },
  { id: "2", name: "Maison de la Viande", rating: 4.6, reviews: 89, distance: "1.2km", time: "20-25 min", isOpen: true, isExpress: false, specialty: "Charolais", image: BUTCHER_IMAGES[1] },
  { id: "3", name: "L'Artisan Boucher", rating: 4.9, reviews: 203, distance: "1.5km", time: "15-20 min", isOpen: true, isExpress: true, specialty: "Bio", image: BUTCHER_IMAGES[2] },
  { id: "4", name: "Boucherie Saint-Pierre", rating: 4.7, reviews: 156, distance: "2.1km", time: "25-30 min", isOpen: true, isExpress: false, specialty: "Agneau", image: BUTCHER_IMAGES[3] },
];

const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "20", price: 10.32, oldPrice: 12.90, shop: "Dupont" },
  { id: "p2", title: "Entrecote premium", discount: "15", price: 32.30, oldPrice: 38.00, shop: "L'Artisan" },
  { id: "p3", title: "Brochettes BBQ", discount: "10", price: 19.80, oldPrice: 22.00, shop: "Maison" },
];

// ─────────────────────────────────────────────────────────────
// BUTCHER CARD - Premium Uber Style
// ─────────────────────────────────────────────────────────────
function ButcherCard({ butcher }: { butcher: typeof BUTCHERS[0] }) {
  const router = useRouter();
  const handleClick = () => router.push(`/boutique/${butcher.id}`);

  return (
    <div onClick={handleClick} className="group cursor-pointer">
      {/* Image container */}
      <div className="relative h-52 rounded-2xl overflow-hidden mb-3">
        <img 
          src={butcher.image} 
          alt={butcher.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {butcher.isExpress && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white text-xs font-medium">{butcher.time}</span>
            </div>
          )}
        </div>
        
        {/* Specialty badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1.5 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-semibold rounded-lg shadow-sm">
            {butcher.specialty}
          </span>
        </div>

        {/* Quick action on hover */}
        <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <button 
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="w-full py-3 bg-white text-gray-900 font-semibold rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
          >
            J'y vais
          </button>
        </div>
      </div>
      
      {/* Info */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-[#DC2626] transition-colors">
              {butcher.name}
            </h3>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md shrink-0">
              <span className="text-xs font-semibold text-gray-900">{butcher.rating}</span>
              <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-gray-500">({butcher.reviews})</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{butcher.distance} • Retrait disponible</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROMO CARD
// ─────────────────────────────────────────────────────────────
function PromoCard({ promo }: { promo: typeof PROMOS[0] }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group">
      <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0">
        <span className="text-white text-sm font-bold">-{promo.discount}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 truncate group-hover:text-[#DC2626] transition-colors">{promo.title}</h4>
        <p className="text-xs text-gray-400 mt-0.5">{promo.shop}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900">{promo.price.toFixed(2).replace(".", ",")} €<span className="text-xs font-normal text-gray-400">/kg</span></p>
        <p className="text-xs text-gray-400 line-through">{promo.oldPrice.toFixed(2).replace(".", ",")} €</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function DecouvrirPage() {
  const { itemCount } = useCart();

  const scrollToHow = () => { document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); };
  const scrollToButchers = () => { document.getElementById("butchers")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HERO WITH INTEGRATED HEADER - DARK */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0A0A0A]">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px"
        }} />
        
        {/* Header */}
        <header className="relative z-10 border-b border-white/5">
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <KlikGoLogo light={true} />
            <div className="flex items-center gap-3">
              {itemCount > 0 && (
                <Link href="/panier" className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                </Link>
              )}
              <Link href="/sign-in" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
                Se connecter
              </Link>
            </div>
          </div>
        </header>
        
        {/* Hero content with CENTERED LOGO */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 py-16 sm:py-20 text-center">
          {/* Centered Logo */}
          <HeroLogo />
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
            Marre d'attendre ?<br />
            <span className="text-[#DC2626]">Commandez, recuperez.</span>
          </h1>
          <p className="mt-5 text-lg text-[#888] max-w-xl mx-auto">
            Zero file. Zero stress. <span className="text-white font-medium">100% frais.</span>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={scrollToButchers}
              className="px-8 py-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-base font-semibold rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]">
              Voir les boucheries
            </button>
            <button onClick={scrollToHow}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white text-base font-medium rounded-2xl transition-all border border-white/10">
              Comment ca marche
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BUTCHERS SECTION - UBER STYLE */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="butchers" className="max-w-6xl mx-auto px-5 py-14">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Boucheries disponibles</h2>
            <p className="text-gray-500 mt-1">Retrait en boutique sous 20 minutes</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full">
              Tous
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors">
              Express
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors">
              Halal
            </button>
          </div>
        </div>
        
        {/* Grid - 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {BUTCHERS.map(butcher => (
            <ButcherCard key={butcher.id} butcher={butcher} />
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
            {PROMOS.map(promo => (
              <PromoCard key={promo.id} promo={promo} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <KlikGoLogo />
            <p className="text-sm text-gray-400">
              2026 Klik&Go — Propulse par TkS26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
