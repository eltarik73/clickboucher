"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, Star, Clock, MapPin, ShoppingBag, Navigation, Plus, Minus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice, UNSPLASH } from "@/lib/utils";

const MOCK_SHOP = {
  id: "shop-1", slug: "savoie-tradition", name: "Boucherie Savoie Tradition",
  description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.",
  address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34",
  imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15,
  isServiceActive: true, tags: ["Viande maturée", "Halal"],
};

const MOCK_PRODUCTS = [
  { id: "p1", name: "Entrecôte", description: "Maturée 21 jours, persillée et tendre", imageUrl: UNSPLASH.products[0], category: "Bœuf", unit: "KG" as const, priceCents: 3200, isInStock: true, weightStep: 100, minWeight: 200 },
  { id: "p2", name: "Côte de bœuf", description: "Race Salers, maturée 30 jours", imageUrl: UNSPLASH.products[1], category: "Bœuf", unit: "KG" as const, priceCents: 3800, isInStock: true, weightStep: 100, minWeight: 600 },
  { id: "p3", name: "Filet mignon de porc", description: "Fermier, idéal en croûte ou rôti", imageUrl: UNSPLASH.products[2], category: "Porc", unit: "KG" as const, priceCents: 1890, isInStock: true, weightStep: 100, minWeight: 300 },
  { id: "p4", name: "Merguez maison", description: "Barquette de 6, épices douces", imageUrl: UNSPLASH.products[3], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 890, isInStock: true, stockQty: 20 },
  { id: "p5", name: "Saucisses de Toulouse", description: "Pur porc, à griller ou poêler", imageUrl: UNSPLASH.products[4], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 790, isInStock: true, stockQty: 15 },
  { id: "p6", name: "Poulet fermier entier", description: "Label Rouge, élevé en plein air", imageUrl: UNSPLASH.products[5], category: "Volaille", unit: "PIECE" as const, priceCents: 1490, isInStock: true, stockQty: 8 },
  { id: "p7", name: "Rôti de veau", description: "Sous la mère, ficelé main", imageUrl: UNSPLASH.products[6], category: "Veau", unit: "KG" as const, priceCents: 2800, isInStock: true, weightStep: 100, minWeight: 500 },
  { id: "p8", name: "Gigot d'agneau", description: "Agneau de lait des Alpes", imageUrl: UNSPLASH.products[7], category: "Agneau", unit: "KG" as const, priceCents: 2600, isInStock: false, weightStep: 100, minWeight: 1000 },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j — Fin de journée", description: "Dernières entrecôtes du jour !", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" } },
];

const CATEGORIES = ["Tout", "Bœuf", "Porc", "Charcuterie", "Volaille", "Veau", "Agneau"];

export default function BoutiquePage({ params }: { params: { id: string } }) {
  const [liked, setLiked] = useState(false);
  const [activeCat, setActiveCat] = useState("Tout");
  const { addItem, itemCount, totalCents, state } = useCart();
  const shop = MOCK_SHOP;
  const shopRef = { id: shop.id, name: shop.name, slug: shop.slug };
  const cartCount = state.shopId === shop.id ? itemCount : 0;

  const filtered = activeCat === "Tout" ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.category === activeCat);

  const handleAddProduct = (p: typeof MOCK_PRODUCTS[0]) => {
    addItem({ id: p.id, name: p.name, imageUrl: p.imageUrl, unit: p.unit, priceCents: p.priceCents, quantity: 1 }, shopRef);
  };

  return (
    <PageContainer padBottom={false}>
      {/* Hero Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] bg-zinc-100">
        <Image src={shop.imageUrl} alt={shop.name} fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Back + Fav */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <Link href="/decouvrir" className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm tap-scale">
            <ArrowLeft size={17} className="text-zinc-900" />
          </Link>
          <button onClick={() => setLiked(!liked)} className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm tap-scale">
            <Heart size={17} className={liked ? "text-red-500 fill-red-500" : "text-zinc-600"} />
          </button>
        </div>

        {/* Shop info on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
          <h1 className="text-white text-xl md:text-2xl font-extrabold text-shadow mb-1">{shop.name}</h1>
          <div className="flex items-center gap-3 text-white/70 text-xs">
            <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" />{shop.rating}</span>
            <span>{shop.reviewCount} avis</span>
            <span className="flex items-center gap-1"><Clock size={11} />{shop.prepTimeMinutes} min</span>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
        <div className="text-[12px] text-zinc-500">
          <span className="flex items-center gap-1"><MapPin size={12} />{shop.address}</span>
          <span className="font-medium text-zinc-900 mt-0.5 block">Retrait le plus tôt : {new Date(Date.now() + shop.prepTimeMinutes * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="flex gap-2">
          {shop.tags?.map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-medium">{t}</span>
          ))}
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-medium hover:bg-zinc-200 transition-colors tap-scale">
            <Navigation size={11} />Itinéraire
          </button>
        </div>
      </div>

      {/* Dernière minute */}
      {MOCK_OFFERS.length > 0 && (
        <div className="pt-5 pb-2">
          <h2 className="px-4 text-base font-bold text-zinc-900 mb-3">🔥 Dernière minute</h2>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
            {MOCK_OFFERS.map((o) => <OfferCard key={o.id} {...o} compact />)}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-zinc-100 px-4 py-3">
        <h2 className="text-base font-bold text-zinc-900 mb-2.5">Catégories</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={activeCat === c ? "chip-active" : "chip"}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-4 py-4 space-y-3 pb-28">
        {filtered.map((p) => (
          <div key={p.id} className={`premium-card p-3 flex gap-3 items-center ${!p.isInStock ? "opacity-50" : ""}`}>
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 shrink-0">
              <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="80px" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold truncate">{p.name}</h4>
              <p className="text-[11px] text-zinc-500 truncate">{p.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-primary">{formatPrice(p.priceCents)}</span>
                <span className="text-[10px] text-zinc-400">{p.unit === "KG" ? "/kg" : p.unit === "PIECE" ? "/pièce" : "/barquette"}</span>
              </div>
              {p.unit === "KG" && p.minWeight && (
                <span className="text-[10px] text-zinc-400">min. {p.minWeight}g • ±10%</span>
              )}
            </div>
            <div className="shrink-0">
              {p.isInStock ? (
                <button onClick={() => handleAddProduct(p)} className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white shadow-sm tap-scale hover:bg-primary/90 transition-colors">
                  <Plus size={16} />
                </button>
              ) : (
                <span className="text-[10px] text-zinc-400 font-medium">Épuisé</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-100 bg-white/90 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-zinc-900">Panier · {cartCount} article{cartCount > 1 ? "s" : ""}</span>
              <span className="text-[12px] text-zinc-500 ml-2">{formatPrice(totalCents)}</span>
            </div>
            <Link href="/panier" className="px-6 py-2.5 rounded-full bg-primary text-white text-[13px] font-semibold shadow-md shadow-primary/20 tap-scale hover:bg-primary/90 transition-colors">
              Commander
            </Link>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
