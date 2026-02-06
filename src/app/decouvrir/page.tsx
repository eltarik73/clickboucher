"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { useCart } from "@/lib/hooks/useCart";

// ─────────────────────────────────────────────────────────────
// LOGO COMPONENT
// ─────────────────────────────────────────────────────────────
function KlikGoLogo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizes = {
    small: { wrapper: "w-8 h-8", text: "text-lg" },
    default: { wrapper: "w-10 h-10", text: "text-xl" },
    large: { wrapper: "w-20 h-20", text: "text-4xl" },
  };
  const s = sizes[size];
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${s.wrapper} relative`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Background circle with gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
            <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#DC2626" floodOpacity="0.3"/>
            </filter>
          </defs>
          
          {/* Main circle */}
          <circle cx="50" cy="50" r="46" fill="url(#logoGradient)" filter="url(#logoShadow)" />
          
          {/* K letter - bold and modern */}
          <path 
            d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z" 
            fill="white"
          />
          
          {/* Speed lines */}
          <line x1="75" y1="35" x2="85" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          <line x1="78" y1="45" x2="90" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <line x1="75" y1="55" x2="83" y2="55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={`${s.text} font-bold text-[#1A1A1A] tracking-tight leading-none`}>
          Klik<span className="text-[#DC2626]">&</span>Go
        </span>
        {size === "large" && (
          <span className="text-xs text-[#9C9590] tracking-wider">by TkS26</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO LOGO (centered, animated)
// ─────────────────────────────────────────────────────────────
function HeroLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 blur-2xl opacity-30 bg-[#DC2626] rounded-full scale-150" />
        
        <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-32 sm:h-32 relative z-10">
          <defs>
            <linearGradient id="heroLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
            <filter id="heroLogoShadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.3"/>
            </filter>
          </defs>
          
          {/* Main circle */}
          <circle cx="50" cy="50" r="46" fill="url(#heroLogoGradient)" filter="url(#heroLogoShadow)" />
          
          {/* K letter */}
          <path 
            d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z" 
            fill="white"
          />
          
          {/* Speed lines with animation */}
          <g className="animate-pulse">
            <line x1="75" y1="35" x2="88" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <line x1="78" y1="45" x2="93" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="75" y1="55" x2="86" y2="55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
      </div>
      
      <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight">
        Klik<span className="text-[#FCA5A5]">&</span>Go
      </h2>
      <p className="text-sm text-[#A0A0A0] tracking-wider mt-1">by TkS26</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IMAGES BOUCHERIES (Pexels)
// ─────────────────────────────────────────────────────────────
const BUTCHER_IMAGES = [
  "https://images.pexels.com/photos/65175/pexels-photo-65175.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
  "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
  "https://images.pexels.com/photos/3535383/pexels-photo-3535383.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
  "https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
  "https://images.pexels.com/photos/1251208/pexels-photo-1251208.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
  "https://images.pexels.com/photos/8477065/pexels-photo-8477065.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
];

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const BUTCHERS = [
  { id: "1", name: "Boucherie Dupont", rating: 4.8, distance: "800m", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[0] },
  { id: "2", name: "Maison de la Viande", rating: 4.6, distance: "1.2km", isOpen: true, isExpress: false, image: BUTCHER_IMAGES[1] },
  { id: "3", name: "Chez Marcel", rating: 4.9, distance: "1.5km", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[2] },
  { id: "4", name: "Boucherie du Marche", rating: 4.4, distance: "2.1km", isOpen: false, isExpress: false, image: BUTCHER_IMAGES[3] },
  { id: "5", name: "L Artisan Boucher", rating: 4.7, distance: "2.8km", isOpen: true, isExpress: false, image: BUTCHER_IMAGES[4] },
  { id: "6", name: "Boucherie Saint-Pierre", rating: 4.5, distance: "3.2km", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[5] },
];

const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "-20%", originalPrice: 12.90, shop: "Dupont" },
  { id: "p2", title: "Entrecote", discount: "-15%", originalPrice: 38.00, shop: "Marcel" },
  { id: "p3", title: "Brochettes BBQ", discount: "-10%", originalPrice: 22.00, shop: "Maison" },
];

// ─────────────────────────────────────────────────────────────
// BUTCHER CARD COMPONENT
// ─────────────────────────────────────────────────────────────
function ButcherCard({ butcher }: { butcher: typeof BUTCHERS[0] }) {
  const router = useRouter();

  const handleClick = () => {
    if (butcher.isOpen) {
      router.push(`/boutique/${butcher.id}`);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`group relative bg-white rounded-2xl border overflow-hidden transition-all duration-300
        ${butcher.isOpen
          ? "border-[#E8E5E1] shadow-sm hover:shadow-lg hover:border-[#D5D0CA] cursor-pointer"
          : "border-[#E8E5E1] opacity-60"
        }`}>
      
      <div className="relative h-36 overflow-hidden bg-[#F5F3F0]">
        <img 
          src={butcher.image} 
          alt={butcher.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {butcher.isOpen ? (
            <span className="px-2 py-0.5 rounded-md bg-[#16A34A] text-white text-[10px] font-semibold shadow-sm">
              Ouvert
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-[#6B6560] text-white text-[10px] font-semibold">
              Ferme
            </span>
          )}
          {butcher.isExpress && butcher.isOpen && (
            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B] text-white text-[10px] font-semibold shadow-sm flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Express
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-[#1A1A1A] text-[15px] leading-tight mb-1.5">
          {butcher.name}
        </h3>
        
        <div className="flex items-center gap-3 text-sm text-[#6B6560]">
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="font-medium">{butcher.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{butcher.distance}</span>
          </div>
        </div>

        <button 
          type="button" 
          disabled={!butcher.isOpen}
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${butcher.isOpen
              ? "bg-[#1A1A1A] text-white hover:bg-[#333] active:scale-[0.98]"
              : "bg-[#F0EDEA] text-[#9C9590] cursor-not-allowed"
            }`}>
          {butcher.isOpen ? "Choisir cette boucherie" : "Actuellement fermee"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROMO CARD COMPONENT
// ─────────────────────────────────────────────────────────────
function PromoCard({ promo }: { promo: typeof PROMOS[0] }) {
  const discountedPrice = promo.originalPrice * (1 - Math.abs(parseInt(promo.discount)) / 100);

  return (
    <div className="bg-white rounded-xl border border-[#E8E5E1] p-3.5 hover:border-[#DC2626]/30 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-[#DC2626] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{promo.discount}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[#1A1A1A] truncate group-hover:text-[#DC2626] transition-colors">
            {promo.title}
          </h4>
          <p className="text-xs text-[#9C9590] mt-0.5">Chez {promo.shop}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-bold text-[#DC2626]">{discountedPrice.toFixed(2)}EUR/kg</span>
            <span className="text-xs text-[#9C9590] line-through">{promo.originalPrice.toFixed(2)}EUR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function DecouvrirPage() {
  const openButchers = BUTCHERS.filter(b => b.isOpen);
  const cart = useCart();

  const scrollToHow = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToButchers = () => {
    document.getElementById("butchers")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* ─────────────── HEADER ─────────────── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E8E5E1] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <KlikGoLogo size="default" />
          <div className="flex items-center gap-3">
            {cart.getItemCount() > 0 && (
              <Link href="/panier" className="relative p-2 rounded-xl bg-[#F5F3F0] hover:bg-[#EBE8E4] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center">
                  {cart.getItemCount()}
                </span>
              </Link>
            )}
            <Link 
              href="/sign-in"
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#1A1A1A] hover:bg-[#333] transition-colors">
              Se connecter
            </Link>
          </div>
        </div>
      </header>

      {/* ─────────────── HERO ─────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#2A2A2A] text-white">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          {/* Centered Logo */}
          <HeroLogo />
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mt-6">
            Marre d attendre ?<br />
            <span className="text-[#FCA5A5]">Commandez, recuperez.</span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-[#A0A0A0] max-w-2xl mx-auto">
            Zero file. Zero stress. <span className="text-white font-medium">100% frais.</span>
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              type="button" 
              onClick={scrollToButchers}
              className="px-8 py-4 rounded-2xl bg-[#DC2626] text-white text-base font-semibold hover:bg-[#B91C1C] transition-all shadow-lg shadow-[#DC2626]/25 active:scale-[0.98]">
              Voir les boucheries
            </button>
            <button 
              type="button" 
              onClick={scrollToHow}
              className="px-8 py-4 rounded-2xl bg-white/10 text-white text-base font-medium hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10">
              Comment ca marche
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────── HOW IT WORKS ─────────────── */}
      <HowItWorks />

      {/* ─────────────── BUTCHERS + PROMOS ─────────────── */}
      <section id="butchers" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Boucheries ouvertes</h2>
              <span className="px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-semibold">
                {openButchers.length} disponibles
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {BUTCHERS.map(butcher => (
                <ButcherCard key={butcher.id} butcher={butcher} />
              ))}
            </div>
          </div>

          <aside className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-[#6B6560] uppercase tracking-wider mb-4">
                Bons plans du jour
              </h3>
              <div className="space-y-3">
                {PROMOS.map(promo => (
                  <PromoCard key={promo.id} promo={promo} />
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="lg:hidden mt-10">
          <h3 className="text-sm font-semibold text-[#6B6560] uppercase tracking-wider mb-4">
            Bons plans du jour
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {PROMOS.map(promo => (
              <div key={promo.id} className="shrink-0 w-[220px]">
                <PromoCard promo={promo} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer className="border-t border-[#E8E5E1] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4">
          <KlikGoLogo size="small" />
          <p className="text-sm text-[#9C9590]">
            2026 Klik&Go - Propulse par TkS26
          </p>
        </div>
      </footer>
    </div>
  );
}
