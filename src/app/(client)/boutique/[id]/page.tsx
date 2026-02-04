"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, Star, Clock, MapPin, ShoppingBag, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TogglePill } from "@/components/ui/toggle-pill";
import { PageContainer } from "@/components/layout/page-container";
import { ProductCard } from "@/components/product/product-card";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice, UNSPLASH } from "@/lib/utils";

const MOCK_SHOP = {
  id: "shop-1", slug: "savoie-tradition", name: "Boucherie Savoie Tradition",
  description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.",
  address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34",
  imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15,
  isServiceActive: true,
};

const MOCK_PRODUCTS = [
  { id: "p1", name: "Entrecôte", description: "Maturée 21 jours, persillée et tendre", imageUrl: UNSPLASH.products[0], category: "Bœuf", unit: "KG" as const, priceCents: 3200, proPriceCents: 2600, isInStock: true, weightStep: 100, minWeight: 200 },
  { id: "p2", name: "Côte de bœuf", description: "Race Salers, maturée 30 jours minimum", imageUrl: UNSPLASH.products[1], category: "Bœuf", unit: "KG" as const, priceCents: 3800, proPriceCents: 3100, isInStock: true, weightStep: 100, minWeight: 600 },
  { id: "p3", name: "Filet mignon de porc", description: "Fermier, idéal en croûte ou rôti", imageUrl: UNSPLASH.products[2], category: "Porc", unit: "KG" as const, priceCents: 1890, proPriceCents: 1550, isInStock: true, weightStep: 100, minWeight: 300 },
  { id: "p4", name: "Merguez maison", description: "Recette aux épices douces, barquette de 6", imageUrl: UNSPLASH.products[3], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 890, proPriceCents: 690, isInStock: true, stockQty: 20 },
  { id: "p5", name: "Saucisses de Toulouse", description: "Pur porc, à griller ou poêler", imageUrl: UNSPLASH.products[4], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 790, proPriceCents: 620, isInStock: true, stockQty: 15 },
  { id: "p6", name: "Poulet fermier entier", description: "Label Rouge, élevé en plein air", imageUrl: UNSPLASH.products[5], category: "Volaille", unit: "PIECE" as const, priceCents: 1490, proPriceCents: 1200, isInStock: true, stockQty: 8 },
  { id: "p7", name: "Rôti de veau", description: "Sous la mère, ficelé main", imageUrl: UNSPLASH.products[6], category: "Veau", unit: "KG" as const, priceCents: 2800, proPriceCents: 2300, isInStock: true, weightStep: 100, minWeight: 500 },
  { id: "p8", name: "Gigot d'agneau", description: "Agneau de lait des Alpes", imageUrl: UNSPLASH.products[7], category: "Agneau", unit: "KG" as const, priceCents: 2600, proPriceCents: 2100, isInStock: false, weightStep: 100, minWeight: 1000 },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j — Fin de journée", description: "Dernières entrecôtes du jour, à saisir !", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true },
];

type Tab = "produits" | "offres";

export default function BoutiquePage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>("produits");
  const [liked, setLiked] = useState(false);
  const { itemCount, totalCents, state } = useCart();
  const shop = MOCK_SHOP;
  const shopRef = { id: shop.id, name: shop.name, slug: shop.slug };
  const cartCount = state.shopId === shop.id ? itemCount : 0;
  const categories = Array.from(new Set(MOCK_PRODUCTS.map((p) => p.category)));

  return (
    <PageContainer padBottom={false}>
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/decouvrir" className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display font-semibold text-sm truncate mx-3">{shop.name}</h1>
          <button onClick={() => setLiked(!liked)} className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
            <Heart size={18} className={liked ? "fill-primary text-primary" : ""} />
          </button>
        </div>
      </header>

      <div className="relative aspect-[16/9] bg-muted">
        <Image src={shop.imageUrl} alt={shop.name} fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
          {shop.isServiceActive ? (
            <Badge variant="success" className="gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current" />Ouvert</Badge>
          ) : (
            <Badge variant="secondary">Fermé</Badge>
          )}
          <div className="flex items-center gap-1 text-white/90 text-sm">
            <Star size={13} className="text-yellow-400 fill-yellow-400" strokeWidth={0} />
            <span className="font-bold">{shop.rating}</span>
            <span className="text-white/60">({shop.reviewCount})</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-3 space-y-2 border-b border-border/60">
        <h2 className="font-display text-title">{shop.name}</h2>
        <p className="text-body text-muted-foreground">{shop.description}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1"><Clock size={13} /><span>{shop.prepTimeMinutes} min</span></div>
          <div className="flex items-center gap-1"><MapPin size={13} /><span className="truncate">{shop.address}</span></div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info size={12} />
          <span>Produits au poids : ajustement ±10%. Au-delà : validation obligatoire.</span>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-border/60">
        <TogglePill active={tab === "produits"} onClick={() => setTab("produits")} label="Produits" />
        <TogglePill active={tab === "offres"} onClick={() => setTab("offres")} label={`Offres (${MOCK_OFFERS.length})`} icon={<span className="text-xs">🔥</span>} />
      </div>

      <div className="px-4 py-4 pb-32">
        {tab === "produits" && (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="font-display font-semibold text-base mb-3">{cat}</h3>
                <div className="space-y-2.5">
                  {MOCK_PRODUCTS.filter((p) => p.category === cat).map((p) => (
                    <ProductCard key={p.id} {...p} shop={shopRef} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "offres" && (
          <div className="space-y-2.5">
            {MOCK_OFFERS.map((o) => <OfferCard key={o.id} {...o} shop={shopRef} />)}
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <Link href="/panier">
            <Button className="w-full h-14 shadow-elevated text-base gap-2" size="lg">
              <ShoppingBag size={20} />
              <span>Voir le panier</span>
              <span className="ml-auto font-display font-bold">{formatPrice(totalCents)}</span>
              <Badge variant="secondary" className="ml-1">{cartCount}</Badge>
            </Button>
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
