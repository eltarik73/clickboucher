"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Search, ShoppingBag, MapPin, Flame } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { ClientHeader } from "@/components/layout/client-header";
import { ShopCard } from "@/components/shop/shop-card";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { UNSPLASH } from "@/lib/utils";

const CHIPS = ["Ouvert", "Retrait < 45 min", "Halal", "Dernière minute", "Traiteur"];

const MOCK_SHOPS = [
  { slug: "savoie-tradition", name: "Boucherie Savoie Tradition", imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15, distance: "350m", tags: ["Viande maturée"], isServiceActive: true, offersCount: 1 },
  { slug: "maison-perrin", name: "Maison Perrin", imageUrl: UNSPLASH.shops[1], rating: 4.6, reviewCount: 89, prepTimeMinutes: 20, distance: "800m", tags: ["Charcuterie artisanale"], isServiceActive: true, offersCount: 1 },
  { slug: "etal-du-marche", name: "L'Étal du Marché", imageUrl: UNSPLASH.shops[2], rating: 4.9, reviewCount: 201, prepTimeMinutes: 10, distance: "1.2km", tags: ["Bio", "Local"], isServiceActive: false, offersCount: 0 },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j", description: "Dernières entrecôtes du jour", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" } },
  { id: "o2", name: "Diots de Savoie x6", description: "Barquette promo du jour", imageUrl: UNSPLASH.products[4], originalCents: 990, discountCents: 590, remainingQty: 5, expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-2", name: "Maison Perrin", slug: "maison-perrin" } },
  { id: "o3", name: "Entrecôte bio", description: "Restant du jour", imageUrl: UNSPLASH.products[1], originalCents: 3900, discountCents: 2790, remainingQty: 2, expiresAt: new Date(Date.now() + 1.5 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-3", name: "L'Étal du Marché", slug: "etal-du-marche" } },
];

export default function DecouvrirPage() {
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const { itemCount } = useCart();

  const filteredShops = MOCK_SHOPS.filter((s) =>
    search === "" || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <ClientHeader />

      {/* Sticky Search + Chips */}
      <div className="sticky top-14 z-30 bg-white/90 backdrop-blur-xl border-b border-zinc-100 px-4 pt-3 pb-2.5">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              placeholder="Rechercher une boucherie, un quartier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-2xl bg-zinc-100 text-[13px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
          <button className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white border border-zinc-200 shadow-sm tap-scale hover:bg-zinc-50 transition-colors">
            <MapPin size={15} className="text-zinc-600" />
          </button>
          {itemCount > 0 && (
            <Link href="/panier" className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-primary text-white shadow-sm tap-scale">
              <ShoppingBag size={15} />
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-white text-primary text-[9px] font-bold flex items-center justify-center border border-primary/20 shadow-sm">
                {itemCount}
              </span>
            </Link>
          )}
        </div>

        {/* Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveChip(activeChip === c ? null : c)}
              className={activeChip === c ? "chip-active" : "chip"}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Banner */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative rounded-3xl overflow-hidden aspect-[21/9]">
          <Image
            src="https://images.unsplash.com/photo-1558030006-450675393462?w=1200&q=85&auto=format"
            alt="Boucherie artisanale"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-8">
            <p className="text-white/50 text-[10px] font-semibold tracking-[0.15em] uppercase mb-1">Chambéry</p>
            <h2 className="text-white text-lg md:text-2xl font-extrabold leading-tight">
              Les meilleurs<br />artisans bouchers
            </h2>
          </div>
        </div>
      </div>

      {/* Dernière minute */}
      {MOCK_OFFERS.length > 0 && (
        <div className="pt-5 pb-2">
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/10">
                <Flame size={12} className="text-primary" />
                <span className="text-[11px] font-bold text-primary">Dernière minute</span>
              </div>
            </div>
            <Link href="/bons-plans" className="text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors">
              Voir tout →
            </Link>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
            {MOCK_OFFERS.map((offer) => (
              <OfferCard key={offer.id} {...offer} compact />
            ))}
          </div>
        </div>
      )}

      {/* Boucheries proches */}
      <div className="pt-5">
        <div className="px-4 mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900">Boucheries proches</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">{filteredShops.length} artisans disponibles</p>
          </div>
        </div>
        <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShops.map((shop, i) => (
            <div key={shop.slug} className={`animate-fade-in-up stagger-${i + 1}`}>
              <ShopCard {...shop} />
            </div>
          ))}
          {filteredShops.length === 0 && (
            <p className="text-center text-zinc-400 py-16 col-span-full text-sm">Aucune boucherie trouvée</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
