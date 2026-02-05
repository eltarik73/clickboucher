"use client";

import { useState } from "react";
import { CartProvider, useCartState } from "@/lib/hooks/useCart";
import { ButcherCard } from "@/components/landing/ButcherCard";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PromoCard } from "@/components/landing/PromoCard";

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const BUTCHERS = [
  { id: "1", name: "Boucherie Dupont", rating: 4.8, distance: "800m", isOpen: true, isExpress: true, image: null },
  { id: "2", name: "Maison de la Viande", rating: 4.6, distance: "1.2km", isOpen: true, isExpress: false, image: null },
  { id: "3", name: "Chez Marcel", rating: 4.9, distance: "1.5km", isOpen: true, isExpress: true, image: null },
  { id: "4", name: "Boucherie du March\u00e9", rating: 4.4, distance: "2.1km", isOpen: false, isExpress: false, image: null },
  { id: "5", name: "L'Artisan Boucher", rating: 4.7, distance: "2.8km", isOpen: true, isExpress: false, image: null },
  { id: "6", name: "Boucherie Saint-Pierre", rating: 4.5, distance: "3.2km", isOpen: true, isExpress: true, image: null },
];

const PROMOS = [
  { id: "p1", title: "Merguez maison", discount: "-20%", originalPrice: 12.90, shop: "Dupont" },
  { id: "p2", title: "Entrec\u00f4te", discount: "-15%", originalPrice: 38.00, shop: "Marcel" },
  { id: "p3", title: "Brochettes BBQ", discount: "-10%", originalPrice: 22.00, shop: "Maison" },
];

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
          <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#1A1A1A] hover:bg-[#333] transition-colors">
            Se connecter
          </button>
        </div>
      </header>

      {/* ─────────────── HERO ─────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#2A2A2A] text-white">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Marre d'attendre ?<br />
            <span className="text-[#DC2626]">Commandez, r&eacute;cup&eacute;rez.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[#A0A0A0] max-w-2xl mx-auto">
            Z&eacute;ro file. Z&eacute;ro stress. <span className="text-white font-medium">100% frais.</span>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button type="button" onClick={scrollToButchers}
              className="px-8 py-4 rounded-2xl bg-[#DC2626] text-white text-base font-semibold hover:bg-[#B91C1C] transition-all shadow-lg shadow-[#DC2626]/25 active:scale-[0.98]">
              Voir les boucheries
            </button>
            <button type="button" onClick={scrollToHow}
              className="px-8 py-4 rounded-2xl bg-white/10 text-white text-base font-medium hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10">
              Comment &ccedil;a marche &darr;
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
              <div key={promo.id} className="shrink-0 w-[200px]">
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
