"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Search, ShoppingBag, Flame } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { ClientHeader } from "@/components/layout/client-header";
import { SectionHeader } from "@/components/layout/section-header";
import { ShopCard } from "@/components/shop/shop-card";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { UNSPLASH } from "@/lib/utils";

const HERO_IMG = "https://images.unsplash.com/photo-1558030006-450675393462?w=1200&q=85&auto=format";

const MOCK_SHOPS = [
  { slug: "savoie-tradition", name: "Boucherie Savoie Tradition", imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15, distance: "350m", tags: ["Viande maturée"], isServiceActive: true, offersCount: 1 },
  { slug: "maison-perrin", name: "Maison Perrin", imageUrl: UNSPLASH.shops[1], rating: 4.6, reviewCount: 89, prepTimeMinutes: 20, distance: "800m", tags: ["Charcuterie artisanale"], isServiceActive: true, offersCount: 1 },
  { slug: "etal-du-marche", name: "L'Étal du Marché", imageUrl: UNSPLASH.shops[2], rating: 4.9, reviewCount: 201, prepTimeMinutes: 10, distance: "1.2km", tags: ["Bio", "Local"], isServiceActive: false, offersCount: 0 },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j", description: "Dernières entrecôtes du jour", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" } },
  { id: "o2", name: "Diots de Savoie x6", description: "Barquette promo du jour", imageUrl: UNSPLASH.products[4], originalCents: 990, discountCents: 590, remainingQty: 5, expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-2", name: "Maison Perrin", slug: "maison-perrin" } },
  { id: "o3", name: "Entrecôte bio", description: "Restant du jour", imageUrl: UNSPLASH.products[0], originalCents: 3900, discountCents: 2790, remainingQty: 2, expiresAt: new Date(Date.now() + 1.5 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-3", name: "L'Étal du Marché", slug: "etal-du-marche" } },
];

export default function DecouvrirPage() {
  const [search, setSearch] = useState("");
  const { itemCount, totalCents } = useCart();

  const filteredShops = MOCK_SHOPS.filter((s) =>
    search === "" || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <ClientHeader />

      {/* Hero Banner */}
      <div className="relative mx-4 mb-6 rounded-2xl overflow-hidden aspect-[21/9]">
        <Image src={HERO_IMG} alt="Boucherie artisanale" fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10">
          <p className="text-amber-400 text-xs font-semibold tracking-[0.15em] uppercase mb-1.5">Chambéry</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-white text-xl md:text-3xl font-bold leading-tight mb-2">
            Les meilleurs<br />artisans bouchers
          </h2>
          <p className="text-white/60 text-sm hidden md:block max-w-xs">Commandez en ligne, retirez en boutique.</p>
        </div>
      </div>

      {/* Search + Cart */}
      <div className="px-4 pb-5 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            placeholder="Rechercher une boucherie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border/60 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>
        {itemCount > 0 && (
          <Link href="/panier" className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground tap-scale shadow-md shadow-primary/20">
            <ShoppingBag size={18} />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
              {itemCount}
            </span>
          </Link>
        )}
      </div>

      {/* Last-minute Offers */}
      {MOCK_OFFERS.length > 0 && (
        <div className="pb-6">
          <div className="flex items-center gap-2 px-4 mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <Flame size={13} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-600">Dernière minute</span>
            </div>
            <Link href="/bons-plans" className="ml-auto text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              Voir tout →
            </Link>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
            {MOCK_OFFERS.map((offer) => (
              <OfferCard key={offer.id} {...offer} compact />
            ))}
          </div>
        </div>
      )}

      {/* Shops */}
      <div className="px-4 mb-3 flex items-end justify-between">
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-bold text-foreground">Boucheries à Chambéry</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{filteredShops.length} artisans disponibles</p>
        </div>
      </div>
      <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShops.map((shop, i) => (
          <div key={shop.slug} className={`animate-fade-in-up stagger-${i + 1}`}>
            <ShopCard {...shop} />
          </div>
        ))}
        {filteredShops.length === 0 && (
          <p className="text-center text-muted-foreground py-12 col-span-full">Aucune boucherie trouvée</p>
        )}
      </div>
    </PageContainer>
  );
}
