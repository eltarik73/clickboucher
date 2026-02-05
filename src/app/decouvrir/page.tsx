"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CartProvider, useCartState } from "@/lib/hooks/useCart";
import { HowItWorks } from "@/components/landing/HowItWorks";

// ─────────────────────────────────────────────────────────────
// IMAGES BOUCHERIES (Unsplash - belles photos artisanales)
// ─────────────────────────────────────────────────────────────
const BUTCHER_IMAGES = [
  "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1606850246029-563d25dbd2b2?w=400&h=300&fit=crop&q=80",
];

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const BUTCHERS = [
  { id: "1", name: "Boucherie Dupont", rating: 4.8, distance: "800m", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[0] },
  { id: "2", name: "Maison de la Viande", rating: 4.6, distance: "1.2km", isOpen: true, isExpress: false, image: BUTCHER_IMAGES[1] },
  { id: "3", name: "Chez Marcel", rating: 4.9, distance: "1.5km", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[2] },
  { id: "4", name: "Boucherie du March\u00e9", rating: 4.4, distance: "2.1km", isOpen: false, isExpress: false, image: BUTCHER_IMAGES[3] },
  { id: "5", name: "L'Artisan Boucher", rating: 4.7, distance: "2.8km", isOpen: true, isExpress: false, image: BUTCHER_IMAGES[4] },
  { id: "6", name: "Boucherie Saint-Pierre", rating: 4.5, distance: "3.2km", isOpen: true, isExpress: true, image: BUTCHER_IMAGES[5] },
];

const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "-20%", originalPrice: 12.90, shop: "Dupont" },
  { id: "p2", title: "Entrec\u00f4te", discount: "-15%", originalPrice: 38.00, shop: "Marcel" },
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
      
      {/* Image */}
      <div className="relative h-36 overflow-hidden">
        <img 
          src={butcher.image} 
          alt={butcher.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {butcher.isOpen ? (
            <span className="px-2 py-0.5 rounded-md bg-[#16A34A] text-white text-[10px] font-semibold shadow-sm">
              Ouvert
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-[#6B6560] text-white text-[10px] font-semibold">
              Ferm&eacute;
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

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[#1A1A1A] text-[15px] leading-tight mb-1.5">
          {butcher.name}
        </h3>
        
        <div className="flex items-center gap-3 text-sm text-[#6B6560]">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="font-medium">{butcher.rating}</span>
          </div>
          {/* Distance */}
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{butcher.distance}</span>
          </div>
        </div>

        {/* CTA */}
        <button 
          type="button" 
          disabled={!butcher.isOpen}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${butcher.isOpen
              ? "bg-[#1A1A1A] text-white hover:bg-[#333] active:scale-[0.98]"
              : "bg-[#F0EDEA] text-[#9C9590] cursor-not-allowed"
            }`}>
          {butcher.isOpen ? "Choisir cette boucherie" : "Actuellement ferm\u00e9e"}
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
            <span className="text-sm font-bold text-[#DC2626]">{discountedPrice.toFixed(2)}&euro;/kg</span>
            <span className="text-xs text-[#9C9590] line-through">{promo.originalPrice.toFixed(2)}&euro;</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN CONTENT
// ─────────────────────────────────────────────────────────────
function LandingContent() {
  const openButchers = BUTCHERS.filter(b => b.isOpen);

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#DC2626] flex items-center justify-center">
              <span className="text-white text-sm font-bold">K</span>
            </div>
            <span className="text-lg font-bold text-[#1A1A1A] tracking-tight">Klik&amp;Go</span>
            <span className="hidden sm:inline text-xs text-[#9C9590] ml-1">by TkS26</span>
          </div>
          <Link 
            href="/sign-in"
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#1A1A1A] hover:bg-[#333] transition-colors">
            Se connecter
          </Link>
        </div>
      </header>

      {/* ─────────────── HERO ─────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#2A2A2A] text-white">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Marre d&apos;attendre ?<br />
            <span className="text-[#DC2626]">Commandez, r&eacute;cup&eacute;rez.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[#A0A0A0] max-w-2xl mx-auto">
            Z&eacute;ro file. Z&eacute;ro stress. <span className="text-white font-medium">100% frais.</span>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
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
              Comment &ccedil;a marche
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────── HOW IT WORKS ─────────────── */}
      <HowItWorks />

      {/* ─────────────── MAIN CONTENT: BUTCHERS + PROMOS SIDEBAR ─────────────── */}
      <section id="butchers" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main: Butchers */}
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

          {/* Sidebar: Promos (desktop) */}
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

        {/* Promos carousel (mobile) */}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-[#9C9590]">
            &copy; 2026 Klik&amp;Go &mdash; Propuls&eacute; par <span className="font-medium text-[#6B6560]">TkS26</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE WRAPPER WITH CART PROVIDER
// ─────────────────────────────────────────────────────────────
export default function DecouvrirPage() {
  const cartState = useCartState();
  return (
    <CartProvider value={cartState}>
      <LandingContent />
    </CartProvider>
  );
}
