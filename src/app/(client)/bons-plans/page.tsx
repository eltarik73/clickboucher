"use client";

import React, { useState } from "react";
import { Flame } from "lucide-react";
import { ClientHeader } from "@/components/layout/client-header";
import { PageContainer } from "@/components/layout/page-container";
import { TogglePill } from "@/components/ui/toggle-pill";
import { OfferCard } from "@/components/offer/offer-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UNSPLASH } from "@/lib/utils";

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j — Fin de journée", description: "Dernières entrecôtes du jour, à saisir !", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" }, category: "Bœuf" },
  { id: "o2", name: "Diots de Savoie — Promo du jour", description: "Barquette de 6 diots à prix cassé", imageUrl: UNSPLASH.products[4], originalCents: 990, discountCents: 590, remainingQty: 5, expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-2", name: "Maison Perrin", slug: "maison-perrin" }, category: "Charcuterie" },
  { id: "o3", name: "Entrecôte bio — Dernière minute", description: "Restant du jour, qualité exceptionnelle", imageUrl: UNSPLASH.products[0], originalCents: 3900, discountCents: 2790, remainingQty: 2, expiresAt: new Date(Date.now() + 1.5 * 3600_000).toISOString(), isSponsored: false, shop: { id: "shop-3", name: "L'Étal du Marché", slug: "etal-du-marche" }, category: "Bœuf" },
];

const CATEGORIES = ["Tout", "Bœuf", "Volaille", "Charcuterie", "Veau", "Agneau"];

export default function BonsPlansPage() {
  const [cat, setCat] = useState("Tout");

  const filtered = cat === "Tout"
    ? MOCK_OFFERS
    : MOCK_OFFERS.filter((o) => o.category === cat);

  return (
    <PageContainer>
      <ClientHeader title="Bons plans" showLocation={false} />

      {/* Category filters */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <TogglePill key={c} active={cat === c} onClick={() => setCat(c)} label={c} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Flame size={28} strokeWidth={1.5} />}
          title="Aucune offre"
          description="Les offres dernière minute apparaîtront ici."
        />
      ) : (
        <div className="px-4 pb-6 space-y-3">
          {filtered.map((offer) => (
            <OfferCard key={offer.id} {...offer} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
