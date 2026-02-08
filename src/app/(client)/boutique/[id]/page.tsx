"use client";
export const dynamic = "force-dynamic";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, Star, Clock, MapPin, Navigation, Sun, Moon } from "lucide-react";
import { OfferCard } from "@/components/offer/offer-card";
import { useCart } from "@/lib/hooks/use-cart";
import { UNSPLASH } from "@/lib/utils";
import { WeightSheet, type WeightSheetProduct } from "@/components/product/WeightSheet";
import { Button } from "@/components/ui/button";

type ViewMode = "col-2" | "col-3" | "mix";

/* ── Theme tokens ──────────────────────────── */
const LIGHT = {
  bg: "#f8f6f3", cardBg: "#fff", cardBorder: "#ece8e3", cardHoverBorder: "#ddd5cc",
  cardShadow: "0 1px 4px rgba(0,0,0,0.03)", cardHoverShadow: "0 8px 24px rgba(0,0,0,0.06)",
  name: "#2a2018", price: "#2a2018", desc: "#b5a99a", cat: "#8b2500", badge: "#8b2500",
  plusBg: "#f5f0eb", plusBorder: "#e8e3dc", plusHoverBg: "#8b2500", plusStroke: "#999",
  stickyBg: "rgba(248,246,243,0.95)", pillBg: "#fff", pillBorder: "#e8e4df",
  pillText: "#999", pillActiveBg: "#8b2500", pillActiveText: "#fff",
  tagBg: "#fff", tagBorder: "#e8e4df", tagText: "#888",
  infoText: "#999", infoStrong: "#444",
  sectionTitle: "#2a2018", sectionBorder: "#e8e4df",
  cartBg: "rgba(255,255,255,0.95)", cartBorder: "#e8e4df", cartText: "#2a2018", cartSub: "#b5a99a",
  ctaBg: "#8b2500", ctaHoverBg: "#6e1d00",
  unitText: "#bbb", minBorder: "#e8e3dc", minText: "#999",
  card3Price: "#8b2500",
};

const DARK = {
  bg: "#0a0a0a", cardBg: "#141414", cardBorder: "#1c1c1c", cardHoverBorder: "#2a2a2a",
  cardShadow: "0 1px 4px rgba(0,0,0,0.2)", cardHoverShadow: "0 8px 24px rgba(0,0,0,0.4)",
  name: "#eee", price: "#fff", desc: "#777", cat: "#dc2626", badge: "#dc2626",
  plusBg: "#1e1e1e", plusBorder: "#2a2a2a", plusHoverBg: "#dc2626", plusStroke: "#666",
  stickyBg: "rgba(10,10,10,0.95)", pillBg: "#141414", pillBorder: "#1c1c1c",
  pillText: "#777", pillActiveBg: "#dc2626", pillActiveText: "#fff",
  tagBg: "#141414", tagBorder: "#1c1c1c", tagText: "#777",
  infoText: "#666", infoStrong: "#bbb",
  sectionTitle: "#eee", sectionBorder: "#1c1c1c",
  cartBg: "rgba(20,20,20,0.95)", cartBorder: "#1c1c1c", cartText: "#eee", cartSub: "#777",
  ctaBg: "#dc2626", ctaHoverBg: "#b91c1c",
  unitText: "#666", minBorder: "#2a2a2a", minText: "#666",
  card3Price: "#dc2626",
};

type Theme = typeof LIGHT;

const MOCK_SHOP = {
  id: "shop-1", slug: "savoie-tradition", name: "Boucherie Savoie Tradition",
  description: "Boucherie artisanale depuis 1987. Viande locale maturée, charcuterie maison.",
  address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34",
  imageUrl: UNSPLASH.shops[0], rating: 4.8, reviewCount: 124, prepTimeMinutes: 15,
  isServiceActive: true, tags: ["Viande maturée", "Halal"],
};

/* Fix: cycle images with modulo to avoid undefined for indices >= 6 */
const pImg = (i: number) => UNSPLASH.products[i % UNSPLASH.products.length];

const MOCK_PRODUCTS = [
  { id: "p1", name: "Entrecôte", description: "Maturée 21 jours, persillée et tendre", imageUrl: pImg(0), category: "Bœuf", unit: "KG" as const, priceCents: 3200, isInStock: true, minWeight: 200, isPopular: true },
  { id: "p2", name: "Côte de bœuf", description: "Race Salers, maturée 30 jours", imageUrl: pImg(1), category: "Bœuf", unit: "KG" as const, priceCents: 3800, isInStock: true, minWeight: 600, isPopular: false },
  { id: "p3", name: "Filet mignon de porc", description: "Fermier, idéal en croûte ou rôti", imageUrl: pImg(2), category: "Porc", unit: "KG" as const, priceCents: 1890, isInStock: true, minWeight: 300, isPopular: false },
  { id: "p4", name: "Merguez maison", description: "Barquette de 6, épices douces", imageUrl: pImg(3), category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 890, isInStock: true, isPopular: true },
  { id: "p5", name: "Saucisses de Toulouse", description: "Pur porc, à griller ou poêler", imageUrl: pImg(4), category: "Charcuterie", unit: "BARQUETTE" as const, priceCents: 790, isInStock: true, isPopular: false },
  { id: "p6", name: "Poulet fermier entier", description: "Label Rouge, élevé en plein air", imageUrl: pImg(5), category: "Volaille", unit: "PIECE" as const, priceCents: 1490, isInStock: true, isPopular: false },
  { id: "p7", name: "Rôti de veau", description: "Sous la mère, ficelé main", imageUrl: pImg(0), category: "Veau", unit: "KG" as const, priceCents: 2800, isInStock: true, minWeight: 500, isPopular: false },
  { id: "p8", name: "Gigot d'agneau", description: "Agneau de lait des Alpes", imageUrl: pImg(1), category: "Agneau", unit: "KG" as const, priceCents: 2600, isInStock: false, minWeight: 1000, isPopular: false },
];

const MOCK_OFFERS = [
  { id: "o1", name: "Entrecôte maturée 21j — Fin de journée", description: "Dernières entrecôtes du jour !", imageUrl: pImg(0), originalCents: 3200, discountCents: 2200, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(), isSponsored: true, shop: { id: "shop-1", name: "Savoie Tradition", slug: "savoie-tradition" } },
];

const CATEGORIES = ["Tout", "Bœuf", "Porc", "Charcuterie", "Volaille", "Veau", "Agneau"];

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" ? "/kg" : unit === "PIECE" ? "/pièce" : "/barq.";
}

/* ── Toggle icons ────────────────────────────── */
function Icon2Col({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#bbb";
  return (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="2" fill={c}/><rect x="10" y="1" width="7" height="7" rx="2" fill={c}/><rect x="1" y="10" width="7" height="7" rx="2" fill={c}/><rect x="10" y="10" width="7" height="7" rx="2" fill={c}/></svg>);
}
function Icon3Col({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#bbb";
  return (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="4.5" height="7" rx="1.5" fill={c}/><rect x="6.75" y="1" width="4.5" height="7" rx="1.5" fill={c}/><rect x="12.5" y="1" width="4.5" height="7" rx="1.5" fill={c}/><rect x="1" y="10" width="4.5" height="7" rx="1.5" fill={c}/><rect x="6.75" y="10" width="4.5" height="7" rx="1.5" fill={c}/><rect x="12.5" y="10" width="4.5" height="7" rx="1.5" fill={c}/></svg>);
}
function IconMix({ active }: { active: boolean }) {
  const c = active ? "#fff" : "#bbb";
  return (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="16" height="7" rx="2" fill={c}/><rect x="1" y="10" width="7" height="7" rx="2" fill={c}/><rect x="10" y="10" width="7" height="7" rx="2" fill={c}/></svg>);
}

/* ── Plus button (themed) ────────────────────── */
function PlusBtn({ size, className, onClick, t }: { size: "sm" | "md" | "lg"; className?: string; onClick: (e: React.MouseEvent) => void; t: Theme }) {
  const s = size === "lg" ? "w-10 h-10 rounded-[13px]" : size === "md" ? "w-[28px] h-[28px] rounded-[9px]" : "w-6 h-6 rounded-[7px]";
  const icon = size === "lg" ? "w-[17px] h-[17px]" : size === "md" ? "w-[14px] h-[14px]" : "w-3 h-3";
  return (
    <button onClick={onClick}
      style={{ background: t.plusBg, borderColor: t.plusBorder, ["--plus-hover-bg" as string]: t.plusHoverBg }}
      className={`${s} border flex items-center justify-center transition-all hover:!bg-[var(--plus-hover-bg)] hover:!border-[var(--plus-hover-bg)] ${className ?? ""}`}>
      <svg style={{ stroke: t.plusStroke }} className={`${icon} stroke-[2.5] fill-none transition-colors`} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

/* ── Card: 1/ligne (large, mix populaires) ──── */
function Card1({ p, onAdd, t }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void; t: Theme }) {
  return (
    <div style={{ background: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow }}
      className={`group relative flex gap-3.5 border rounded-[18px] p-2.5 cursor-pointer
      transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.985] min-w-0 overflow-hidden
      ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      {p.isPopular && <span style={{ background: t.badge }} className="absolute -top-px right-14 text-white text-[7.5px] font-extrabold px-2.5 py-[3px] rounded-b-lg tracking-wider z-10">POPULAIRE</span>}
      <div className="w-[85px] h-[85px] rounded-[14px] overflow-hidden shrink-0">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span style={{ color: t.cat }} className="text-[9px] font-bold uppercase tracking-wider mb-0.5">{p.category}</span>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", color: t.name }} className="text-[17px] font-bold leading-tight">{p.name}</h3>
        <p style={{ color: t.desc }} className="text-xs mt-0.5 truncate">{p.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span style={{ color: t.price }} className="text-base font-extrabold">{fmtPrice(p.priceCents)}</span>
          <span style={{ color: t.unitText }} className="text-[11px] font-semibold">{unitLabel(p.unit)}</span>
          {p.unit === "KG" && p.minWeight && <span style={{ color: t.minText, borderColor: t.minBorder }} className="text-[9px] border px-1.5 py-0.5 rounded-[5px] font-semibold">min. {p.minWeight}g</span>}
        </div>
      </div>
      <PlusBtn t={t} size="lg" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
    </div>
  );
}

/* ── Card: 2/ligne (compact horizontal) ──────── */
function Card2({ p, onAdd, t }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void; t: Theme }) {
  return (
    <div style={{ background: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow }}
      className={`group relative flex gap-3 border rounded-[18px] p-2.5 cursor-pointer
      transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] min-w-0 overflow-hidden
      ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      {p.isPopular && <span style={{ background: t.badge }} className="absolute -top-px -left-px text-white text-[7px] font-extrabold px-2 py-0.5 rounded-[18px_0_10px_0] tracking-wide z-10">POPULAIRE</span>}
      <div className="w-[68px] h-[68px] rounded-[13px] overflow-hidden shrink-0">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span style={{ color: t.cat }} className="text-[9px] font-bold uppercase tracking-wider mb-0.5">{p.category}</span>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", color: t.name }} className="text-[15px] font-bold leading-tight truncate">{p.name}</h3>
        <p style={{ color: t.desc }} className="text-[10.5px] mt-0.5 truncate">{p.description}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span style={{ color: t.price }} className="text-sm font-extrabold">{fmtPrice(p.priceCents)}</span>
          <span style={{ color: t.unitText }} className="text-[10px] font-semibold">{unitLabel(p.unit)}</span>
        </div>
      </div>
      <PlusBtn t={t} size="md" className="absolute right-2.5 bottom-2.5" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
    </div>
  );
}

/* ── Card: 3/ligne (vertical mini) ──────────── */
function Card3({ p, onAdd, t }: { p: typeof MOCK_PRODUCTS[0]; onAdd: () => void; t: Theme }) {
  return (
    <div style={{ background: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow }}
      className={`group relative flex flex-col border rounded-[16px] overflow-hidden cursor-pointer min-w-0
      transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]
      ${!p.isInStock ? "opacity-50 pointer-events-none" : ""}`}>
      {p.isPopular && <span style={{ background: t.badge }} className="absolute top-1 left-1 text-white text-[7px] font-extrabold px-1.5 py-0.5 rounded-[5px] z-10 tracking-wide">POPULAIRE</span>}
      <div className="w-full h-[70px] overflow-hidden">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-2">
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", color: t.name }} className="text-xs font-bold leading-tight truncate">{p.name}</h3>
        <div className="flex items-center justify-between mt-1.5">
          <span style={{ color: t.card3Price }} className="text-[12.5px] font-extrabold">{fmtPrice(p.priceCents)}{unitLabel(p.unit)}</span>
          <PlusBtn t={t} size="sm" onClick={(e) => { e.stopPropagation(); onAdd(); }} />
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────── */
export default function BoutiquePage({ params }: { params: { id: string } }) {
  const [liked, setLiked] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Tout");
  const [viewMode, setViewMode] = useState<ViewMode>("col-2");
  const [dark, setDark] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WeightSheetProduct | null>(null);
  const { addItem, itemCount, totalCents, state } = useCart();
  const shop = MOCK_SHOP;
  const shopRef = { id: shop.id, name: shop.name, slug: shop.slug };
  const cartCount = state.shopId === shop.id ? itemCount : 0;
  const t = dark ? DARK : LIGHT;

  const filtered = activeCat === "Tout" ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.category === activeCat);
  const popular = filtered.filter((p) => p.isPopular);
  const rest = filtered.filter((p) => !p.isPopular);

  const handleAdd = useCallback((p: typeof MOCK_PRODUCTS[0]) => {
    if (p.unit === "KG") {
      setSelectedProduct(p);
      return;
    }
    addItem({
      id: p.id,
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      unit: p.unit,
      priceCents: p.priceCents,
      quantity: 1,
      category: p.category,
    }, shopRef);
  }, [addItem, shopRef]);

  const handleWeightConfirm = useCallback((weightG: number) => {
    if (!selectedProduct) return;
    addItem({
      id: selectedProduct.id,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      imageUrl: selectedProduct.imageUrl,
      unit: "KG",
      priceCents: selectedProduct.priceCents,
      quantity: 1,
      weightGrams: weightG,
      category: selectedProduct.category,
      quantiteG: weightG,
      prixAuKg: selectedProduct.priceCents / 100,
    }, shopRef);
    setSelectedProduct(null);
  }, [selectedProduct, addItem, shopRef]);

  return (
    <div style={{ background: t.bg }} className="min-h-screen transition-colors duration-300">
      <div className="mx-auto max-w-5xl">
        {/* Hero — arrondi 24px avec glassmorphism */}
        <div className="relative mx-3 mt-3 rounded-[24px] overflow-hidden" style={{ height: 300 }}>
          <Image src={shop.imageUrl} alt={shop.name} fill className="object-cover" sizes="100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-[24px]" />
          {/* Top buttons — glassmorphism */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Link href="/decouvrir" className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <ArrowLeft size={17} className="text-[#333]" />
            </Link>
            <button onClick={() => setLiked(!liked)} className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white/85 backdrop-blur-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <Heart size={17} className={liked ? "text-red-500 fill-red-500" : "text-[#333]"} />
            </button>
          </div>
          {/* Shop info overlay */}
          <div className="absolute bottom-6 left-5">
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-white text-[30px] font-bold leading-[1.05]">{shop.name}</h1>
            <div className="flex gap-2.5 mt-2.5">
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xl px-3 py-1.5 rounded-[10px]">
                <Star size={12} className="text-yellow-300 fill-yellow-300" />
                <span className="text-xs font-bold text-white">{shop.rating} · {shop.reviewCount} avis</span>
              </div>
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xl px-3 py-1.5 rounded-[10px]">
                <Clock size={11} className="text-white" />
                <span className="text-xs font-bold text-white">{shop.prepTimeMinutes} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="text-xs" style={{ color: t.infoText }}>
            <span className="flex items-center gap-1"><MapPin size={12} />{shop.address}</span>
            <span className="font-medium mt-0.5 block" style={{ color: t.infoStrong }}>Retrait le plus tôt : {new Date(Date.now() + shop.prepTimeMinutes * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="flex gap-1.5">
            {shop.tags?.map((tag) => (
              <span key={tag} style={{ background: t.tagBg, borderColor: t.tagBorder, color: t.tagText }} className="px-2.5 py-1 rounded-lg border text-[10px] font-bold">{tag}</span>
            ))}
            <button style={{ background: t.tagBg, borderColor: t.tagBorder, color: t.tagText }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors">
              <Navigation size={11} />Itinéraire
            </button>
          </div>
        </div>

        {/* Dernière minute */}
        {MOCK_OFFERS.length > 0 && (
          <div className="pb-2">
            <h2 style={{ color: t.sectionTitle }} className="px-5 text-base font-bold mb-3">Dernière minute</h2>
            <div className="flex gap-3 px-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
              {MOCK_OFFERS.map((o) => <OfferCard key={o.id} {...o} compact />)}
            </div>
          </div>
        )}

        {/* Sticky bar: toggle + categories */}
        <div style={{ background: t.stickyBg }} className="sticky top-0 z-20 backdrop-blur-xl px-5 py-3 transition-colors duration-300">
          <div className="flex items-center justify-between mb-2.5">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: t.sectionTitle }} className="text-lg font-bold">Catalogue</h2>
            <div className="flex gap-1.5 items-center">
              {/* Day/Night toggle */}
              <button onClick={() => setDark(!dark)}
                className="p-2 rounded-xl border transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                style={{ background: dark ? "#1e1e1e" : "#fff", borderColor: dark ? "#2a2a2a" : "#e8e4df" }}
                title={dark ? "Mode jour" : "Mode nuit"}>
                {dark
                  ? <Sun size={18} className="text-amber-400" />
                  : <Moon size={18} className="text-[#999]" />}
              </button>
              <div className="w-px h-5 mx-0.5" style={{ background: dark ? "#2a2a2a" : "#e8e4df" }} />
              {/* View mode toggles */}
              {([["col-2", Icon2Col], ["col-3", Icon3Col], ["mix", IconMix]] as const).map(([mode, Icon]) => (
                <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
                  style={viewMode === mode
                    ? { background: t.pillActiveBg, borderColor: t.pillActiveBg }
                    : { background: t.pillBg, borderColor: t.pillBorder }}
                  className="p-2 rounded-xl border transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <Icon active={viewMode === mode} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setActiveCat(c)}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all border shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${
                  activeCat === c
                    ? "bg-[#8b2500] border-[#8b2500] text-white"
                    : "bg-white border-[#e8e4df] text-[#999]"
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div>
          {viewMode === "col-2" && (
            <div className="grid grid-cols-2 gap-3 px-4 pb-24">
              {filtered.map((p) => <Card2 key={p.id} p={p} t={t} onAdd={() => handleAdd(p)} />)}
            </div>
          )}

          {viewMode === "col-3" && (
            <div className="grid grid-cols-3 gap-3 px-4 pb-24">
              {filtered.map((p) => <Card3 key={p.id} p={p} t={t} onAdd={() => handleAdd(p)} />)}
            </div>
          )}

          {viewMode === "mix" && (
            <div className="px-4 pb-24">
              {popular.length > 0 && (
                <>
                  <div style={{ color: t.cat, borderColor: t.sectionBorder }} className="text-[11px] font-bold uppercase tracking-[1.5px] mb-2.5 pb-1.5 border-b">Populaires</div>
                  <div className="flex flex-col gap-3 mb-5">
                    {popular.map((p) => <Card1 key={p.id} p={p} t={t} onAdd={() => handleAdd(p)} />)}
                  </div>
                </>
              )}
              {rest.length > 0 && (
                <>
                  <div style={{ color: t.cat, borderColor: t.sectionBorder }} className="text-[11px] font-bold uppercase tracking-[1.5px] mb-2.5 pb-1.5 border-b">Tout le catalogue</div>
                  <div className="grid grid-cols-2 gap-3">
                    {rest.map((p) => <Card2 key={p.id} p={p} t={t} onAdd={() => handleAdd(p)} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sticky Cart Bar */}
        {cartCount > 0 && (
          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#ece8e3] px-4 py-3 flex items-center justify-between shadow-lg z-50">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-[#2a2018]">{cartCount} article{cartCount > 1 ? "s" : ""}</span>
              <span className="text-sm text-[#b5a99a] ml-2">{fmtPrice(totalCents)}</span>
            </div>
            <Button variant="default" className="bg-[#8b2500] hover:bg-[#6d1d00]" asChild>
              <Link href="/panier">Commander</Link>
            </Button>
          </div>
        )}
      </div>

      {/* WeightSheet bottom sheet for KG items */}
      <WeightSheet
        product={selectedProduct}
        onConfirm={handleWeightConfirm}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
