"use client";

import React from "react";
import { Heart } from "lucide-react";
import Link from "next/link";
import { ClientHeader } from "@/components/layout/client-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { ShopCard } from "@/components/shop/shop-card";
import { Button } from "@/components/ui/button";
import { UNSPLASH } from "@/lib/utils";

// Mock: would come from API GET /api/favorites?userId=
const MOCK_FAVORITES = [
  { slug: "savoie-tradition", name: "Boucherie Savoie Tradition", imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15, distance: "350m", isServiceActive: true, offersCount: 1 },
  { slug: "etal-du-marche", name: "L'Étal du Marché", imageUrl: UNSPLASH.shops[2], rating: 4.9, reviewCount: 201, prepTimeMinutes: 10, distance: "1.2km", isServiceActive: false, offersCount: 0 },
];

export default function FavorisPage() {
  const favorites = MOCK_FAVORITES;

  return (
    <PageContainer>
      <ClientHeader title="Favoris" showLocation={false} />

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={28} strokeWidth={1.5} />}
          title="Pas encore de favoris"
          description="Ajoutez vos boucheries préférées pour les retrouver facilement ici."
          action={<Button asChild><Link href="/decouvrir">Découvrir les boucheries</Link></Button>}
        />
      ) : (
        <div className="px-4 py-4 space-y-4">
          {favorites.map((shop) => (
            <ShopCard key={shop.slug} {...shop} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
