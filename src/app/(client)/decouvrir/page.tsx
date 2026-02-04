"use client";

import React, { useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { ClientHeader } from "@/components/layout/client-header";
import { ShopCard } from "@/components/shop/shop-card";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { UNSPLASH } from "@/lib/utils";

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

      {/* Search + Cart */}
      <div className="px-4 pb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une boucherie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        {itemCount > 0 && (
          <Link href="/panier" className="relative flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground tap-scale">
            <ShoppingBag size={18} />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
              {itemCount}
            </span>
          </Link>
        )}
      </div>

      {/* Last-minute Offers */}
      {MOCK_OFFERS.length > 0 && (
        <div className="pb-4">
          <SectionHeader title="🔥 Dernière minute" subtitle="Offres à saisir" href="/bons-plans" />
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
            {MOCK_OFFERS.map((offer) => (
              <OfferCard key={offer.id} {...offer} compact />
            ))}
          </div>
        </div>
      )}

      {/* Shops */}
      <SectionHeader title="Boucheries à Chambéry" subtitle={`${filteredShops.length} résultats`} />
      <div className="px-4 pb-6 space-y-4">
        {filteredShops.map((shop) => (
          <ShopCard key={shop.slug} {...shop} />
        ))}
        {filteredShops.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucune boucherie trouvée</p>
        )}
      </div>
    </PageContainer>
  );
}
