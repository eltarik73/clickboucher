"use client";
export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, Star, Clock, MapPin, Navigation, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { UNSPLASH } from "@/lib/utils";

type ViewMode = "col-2" | "col-3" | "mix";

const MOCK_SHOP = {
  id: "shop-1", slug: "savoie-tradition", name: "Boucherie Savoie Tradition",
  description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.",
  address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34",
  imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15,
  isServiceActive: true, tags: ["Viande maturée", "Halal"],
};

const MOCK_PRODUCTS = [
  { id: "p1", name: "Entrecôte", description: "Maturée 21 jours, persillée et tendre", imageUrl: UNSPLASH.products[0], category: "Bœuf", unit: "KG" as const, priceCents: 3200, isInStock: true, minWeight: 200, isPopular: true },
  { id: "p2", name: "Côte de bœuf", description: "Race Salers, maturée 30 jours", imageUrl: UNSPLASH.products[1], category: "Bœuf", unit: "KG" as const, priceCents: 3800, isInStock: true, minWeight: 600, isPopular: false },
  { id: "p3", name: "Filet mignon de porc", description: "Fermier, idéal en croûte ou rôti", imageUrl: UNSPLASH.products[2], category: "Porc", unit: "KG" as const, priceCents: 1890, isInStock: true, minWeight: 300, isPopular: false },
  { id: "p4", name: "Merguez maison", description: "Barquette de 6, épices douces", imageUrl: UNSPLASH.products[3], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 890, isInStock: true, isPopular: true },
  { id: "p5", name: "Saucisses de Toulouse", description: "Pur porc, à griller ou poêler", imageUrl: UNSPLASH.products[4], category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 790, isInStock: true, isPopular: false },
  { id: "p6", name: "Poulet fermier entier", description: "Label Rouge, élevé en plein air", imageUrl: UNSPLASH.products[5], category: "Volaille", unit: "PIECE" as const, priceCents: 1490, isInStock: true, isPopular: false },
  { id: "p7", name: "Rôti de veau", description: "Sous la mère, ficelé main", imageUrl: UNSPLASH.products[6], category: "Veau", unit: "KG" as const, priceCents: 2800, isInStock: true, minWeight: 500, isPopular: false },
  { id: "p8", name: "Gigot d'agneau", description: "Agneau de lait des Alpes", imageUrl: UNSPLASH.products[7], category: "Agneau", unit: "KG" as const, priceCents: 2600, isInStock: false, minWeight: 1000, isPopular: false },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j — Fin de journée", description: "Dernières entrecôtes du jour !", imageUrl: UNSPLASH.products[0], originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" } },
];

const CATEGORIES = ["Tout", "Bœuf", "Porc", "Charcuterie", "Volaille", "Veau", "Agneau"];

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pièce" : "/barq.";
}

/* ── SVG toggle icons ──────────────────────── */
function Icon2Col({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#666";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="2" fill={c} />
      <rect x="10" y="1" width="7" height="7" rx="2" fill={c} />
      <rect x="1" y="10" width="7" height="7" rx="2" fill={c} />
      <rect x="10" y="10" width="7" height="7" rx="2" fill={c} />
    </svg>
  );
}
function Icon3Col({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#666";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="4.5" height="7" rx="1.5" fill={c} />
      <rect x="6.75" y="1" width="4.5" height="7" rx="1.5" fill={c} />
      <rect x="12.5" y="1" width="4.5" height="7" rx="1.5" fill={c} />
      <rect x="1" y="10" width="4.5" height="7" rx="1.5" fill={c} />
      <rect x="6.75" y="10" width="4.5" height="7" rx="1.5" fill={c} />
      <rect x="12.5" y="10" width="4.5" height="7" rx="1.5" fill={c} />
    </svg>
  );
}
function IconMix({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#666";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="16" height="7" rx="2" fill={c} />
      <rect x="1" y="10" width="7" height="7" rx="2" fill={c} />
      <rect x="10" y="10" width="7" height="7" rx="2" fill={c} />
    </svg>
  );
}

/* ── Plus icon for cards ───────────────────── */
function PlusBtn({ size, className, onClick }: { size: "sm" | "md" | "lg"; className?: string; onClick: (e: React.MouseEvent) => void }) {
  const s = size === "lg" ? "w-10 h-10 rounded-[13px]" : size === "md" ? "w-[30px] h-[30px] rounded-[10px]" : "w-6 h-6 rounded-[7px]";
  const icon = size === "lg" ? "w-[17px] h-[17px]" : size === "md" ? "w-[14px] h-[14px]" : "w-3 h-3";
  return (
    <button onClick={onClick}
      className={`${s} bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center transition-all
        group-hover:bg-[#dc2626] group-hover:border-[#dc2626] ${className ?? ""}`}>
      <svg className={`${icon} stroke-[#555] stroke-[2.5] fill-none group-hover:stroke-white`} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

/* ── Card: 1 par ligne (large horizontal) ──── */
function Card1({ p, onAdd }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void }) {
  return (
    <div className={`group relative flex gap-3.5 bg-[#141414] border border-[#1e1e1e] rounded-[18px] p-2.5 cursor-pointer
      transition-all duration-200 overflow-hidden hover:border-[#333] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(220,38,38,0.07)]
      active:scale-[0.985] ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(220,38,38,0.03)] to-transparent pointer-events-none" />
      {p.isPopular && <span className="absolute -top-px right-14 bg-gradient-to-br from-[#dc2626] to-[#b91c1c] text-white text-[8px] font-extrabold px-2.5 py-0.5 rounded-b-lg tracking-wider z-10">POPULAIRE</span>}
      <div className="w-[85px] h-[85px] rounded-[14px] overflow-hidden border border-[#222] shrink-0">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center relative z-[1]">
        <span className="text-[9.5px] font-bold text-[#dc2626] uppercase tracking-wider mb-0.5">{p.category}</span>
        <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-base font-bold text-[#f0f0f0] leading-tight">{p.name}</h3>
        <p className="text-xs text-[#4a4a4a] mt-0.5 truncate">{p.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base font-extrabold text-white">{fmtPrice(p.priceCents)}</span>
          <span className="text-[11px] text-[#555] font-semibold">{unitLabel(p.unit)}</span>
          {p.unit === "KG" && p.minWeight && <span className="text-[9px] text-[#444] border border-[#252525] px-1.5 py-0.5 rounded-[5px] font-semibold">min. {p.minWeight}g</span>}
        </div>
      </div>
      <PlusBtn size="lg" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
    </div>
  );
}

/* ── Card: 2 par ligne (compact horizontal) ── */
function Card2({ p, onAdd }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void }) {
  return (
    <div className={`group relative flex gap-2.5 bg-[#141414] border border-[#1e1e1e] rounded-2xl p-2 cursor-pointer
      transition-all duration-200 overflow-hidden hover:border-[#333] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(220,38,38,0.06)]
      active:scale-[0.97] ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(220,38,38,0.03)] to-transparent pointer-events-none" />
      {p.isPopular && <span className="absolute top-0 left-0 bg-[#dc2626] text-white text-[7px] font-extrabold px-2 py-0.5 rounded-[16px_0_8px_0] tracking-wide z-10">POPULAIRE</span>}
      <div className="w-[68px] h-[68px] rounded-xl overflow-hidden border border-[#222] shrink-0">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center relative z-[1]">
        <span className="text-[8px] font-bold text-[#dc2626] uppercase tracking-wider mb-0.5">{p.category}</span>
        <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-[13.5px] font-bold text-[#eee] leading-tight truncate">{p.name}</h3>
        <p className="text-[10.5px] text-[#444] mt-0.5 truncate">{p.description}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-extrabold text-white">{fmtPrice(p.priceCents)}</span>
          <span className="text-[10px] text-[#555] font-semibold">{unitLabel(p.unit)}</span>
        </div>
      </div>
      <PlusBtn size="md" className="absolute right-2 bottom-2" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
    </div>
  );
}

/* ── Card: 3 par ligne (vertical mini) ─────── */
function Card3({ p, onAdd }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void }) {
  return (
    <div className={`group relative flex flex-col bg-[#141414] border border-[#1e1e1e] rounded-[14px] overflow-hidden cursor-pointer
      transition-all duration-200 hover:border-[#333] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(220,38,38,0.06)]
      active:scale-[0.96] ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      {p.isPopular && <span className="absolute top-1 left-1 bg-[#dc2626] text-white text-[7px] font-extrabold px-1.5 py-0.5 rounded-[5px] z-10 tracking-wide">POPULAIRE</span>}
      <div className="w-full h-[70px] overflow-hidden">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-2 relative z-[2]">
        <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-xs font-bold text-[#eee] leading-tight truncate">{p.name}</h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[12.5px] font-extrabold text-[#dc2626]">{fmtPrice(p.priceCents)}{unitLabel(p.unit)}</span>
          <PlusBtn size="sm" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────── */
export default function BoutiquePage({ params }: { params: { id: string } }) {
  const [liked, setLiked] = useState(false);
  const [activeCat, setActiveCat] = useState("Tout");
  const [viewMode, setViewMode] = useState<ViewMode>("col-2");
  const { addItem, itemCount, totalCents, state } = useCart();
  const shop = MOCK_SHOP;
  const shopRef = { id: shop.id, name: shop.name, slug: shop.slug };
  const cartCount = state.shopId === shop.id ? itemCount : 0;

  const filtered = activeCat === "Tout" ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.category === activeCat);
  const popular = filtered.filter((p) => p.isPopular);
  const rest = filtered.filter((p) => !p.isPopular);

  const handleAdd = (p: typeof MOCK_PRODUCTS[0]) => {
    addItem({ id: p.id, name: p.name, imageUrl: p.imageUrl, unit: p.unit, priceCents: p.priceCents, quantity: 1 }, shopRef);
  };

  return (
    <PageContainer padBottom={false}>
      {/* Hero Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] bg-zinc-100">
        <Image src={shop.imageUrl} alt={shop.name} fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <Link href="/decouvrir" className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm">
            <ArrowLeft size={17} className="text-zinc-900" />
          </Link>
          <button onClick={() => setLiked(!liked)} className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm">
            <Heart size={17} className={liked ? "text-red-500 fill-red-500" : "text-zinc-600"} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
          <h1 className="text-white text-xl md:text-2xl font-extrabold mb-1">{shop.name}</h1>
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
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-medium hover:bg-zinc-200 transition-colors">
            <Navigation size={11} />Itinéraire
          </button>
        </div>
      </div>

      {/* Dernière minute */}
      {MOCK_OFFERS.length > 0 && (
        <div className="pt-5 pb-2">
          <h2 className="px-4 text-base font-bold text-zinc-900 mb-3">Dernière minute</h2>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
            {MOCK_OFFERS.map((o) => <OfferCard key={o.id} {...o} compact />)}
          </div>
        </div>
      )}

      {/* ═══ Dark product section ═══ */}
      <div className="bg-[#0a0a0a] mt-2">
        {/* Sticky bar: categories + toggle */}
        <div className="sticky top-0 z-20 bg-[rgba(10,10,10,0.95)] backdrop-blur-xl border-b border-[#1a1a1a] px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-base font-bold text-white">Catalogue</h2>
            {/* View toggle */}
            <div className="flex gap-1.5">
              {([["col-2", Icon2Col], ["col-3", Icon3Col], ["mix", IconMix]] as const).map(([mode, Icon]) => (
                <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
                  className={`p-2 rounded-xl border transition-all ${viewMode === mode
                    ? "bg-[#dc2626] border-[#dc2626]"
                    : "bg-transparent border-[#222] hover:border-[#444]"}`}>
                  <Icon active={viewMode === mode} />
                </button>
              ))}
            </div>
          </div>
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setActiveCat(c)}
                className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold whitespace-nowrap transition-all border
                  ${activeCat === c
                    ? "bg-[#dc2626] text-white border-[#dc2626]"
                    : "bg-[#141414] text-[#555] border-[#222] hover:border-[#444] hover:text-[#aaa]"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="px-3 py-4 pb-28">
          {viewMode === "col-2" && (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((p) => <Card2 key={p.id} p={p} onAdd={() => handleAdd(p)} />)}
            </div>
          )}

          {viewMode === "col-3" && (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((p) => <Card3 key={p.id} p={p} onAdd={() => handleAdd(p)} />)}
            </div>
          )}

          {viewMode === "mix" && (
            <>
              {popular.length > 0 && (
                <>
                  <div className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[1.5px] mb-2.5 pb-1.5 border-b border-[#1a1a1a]">Populaires</div>
                  <div className="flex flex-col gap-2.5 mb-4">
                    {popular.map((p) => <Card1 key={p.id} p={p} onAdd={() => handleAdd(p)} />)}
                  </div>
                </>
              )}
              {rest.length > 0 && (
                <>
                  <div className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[1.5px] mb-2.5 pb-1.5 border-b border-[#1a1a1a]">Tout le catalogue</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {rest.map((p) => <Card2 key={p.id} p={p} onAdd={() => handleAdd(p)} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-white">Panier · {cartCount} article{cartCount > 1 ? "s" : ""}</span>
              <span className="text-[12px] text-[#555] ml-2">{fmtPrice(totalCents)}</span>
            </div>
            <Link href="/panier" className="px-6 py-2.5 rounded-full bg-[#dc2626] text-white text-[13px] font-semibold shadow-md shadow-red-500/20 hover:bg-[#b91c1c] transition-colors">
              Commander
            </Link>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
