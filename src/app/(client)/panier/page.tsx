"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Trash2, Info, Plus, Minus, Clock, Scale } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

const SLOTS = [
  { id: "s1", label: "11:30", full: false },
  { id: "s2", label: "12:00", full: false },
  { id: "s3", label: "12:30", full: true },
  { id: "s4", label: "13:00", full: false },
  { id: "s5", label: "18:00", full: false },
  { id: "s6", label: "18:30", full: false },
  { id: "s7", label: "19:00", full: false },
];

export default function PanierPage() {
  const { state, itemCount, totalCents, clear, updateQuantity, removeItem } = useCart();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const isEmpty = state.items.length === 0;
  const hasWeightItems = state.items.some((i) => i.unit === "KG");
  const maxTotal = Math.round(totalCents * 1.1);

  if (isEmpty) {
    return (
      <PageContainer>
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-zinc-100">
          <div className="flex items-center gap-3 h-14 px-4">
            <Link href="/decouvrir" className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 tap-scale">
              <ArrowLeft size={17} />
            </Link>
            <h1 className="text-base font-bold">Panier</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
            <ShoppingBag size={28} className="text-zinc-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Panier vide</h2>
          <p className="text-sm text-zinc-500 mb-6">Ajoutez des produits depuis une boucherie pour commencer.</p>
          <Link href="/decouvrir" className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold tap-scale">
            Découvrir les boucheries
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer padBottom={false}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-zinc-100">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link href={state.shopSlug ? `/boutique/${state.shopSlug}` : "/decouvrir"} className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 tap-scale">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="text-base font-bold">Panier</h1>
              {state.shopName && <p className="text-[11px] text-zinc-500">{state.shopName}</p>}
            </div>
          </div>
          <button onClick={clear} className="text-[12px] text-red-500 font-medium tap-scale flex items-center gap-1">
            <Trash2 size={13} />Vider
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 pb-36">
        {/* Items */}
        {state.items.map((item) => (
          <div key={item.id} className="premium-card p-3 flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 overflow-hidden relative shrink-0">
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold truncate">{item.name}</h4>
              {item.unit === "KG" && item.requestedWeight && (
                <p className="text-[10px] text-zinc-400">Demandé {item.requestedWeight}g (±10%)</p>
              )}
              <span className="text-sm font-bold text-primary">{formatPrice(item.priceCents * item.quantity)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeItem(item.id)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center tap-scale">
                <Minus size={13} />
              </button>
              <span className="text-[13px] font-semibold w-5 text-center">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center tap-scale">
                <Plus size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Weight reassurance */}
        {hasWeightItems && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <Scale size={15} />
              <span className="text-[12px] font-semibold">Produits au poids : ajustement ±10%</span>
            </div>
            <ul className="text-[11px] text-amber-600 space-y-1 pl-6">
              <li>Au-delà de +10% : validation obligatoire.</li>
              <li>En dessous de −10% : on complète ou on vous demande.</li>
            </ul>
            <div className="flex justify-between text-[12px] pt-1 border-t border-amber-200/40">
              <span className="text-zinc-600">Total estimé</span>
              <span className="font-bold">{formatPrice(totalCents)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Plafond autorisé (+10%)</span>
              <span className="text-zinc-500">{formatPrice(maxTotal)}</span>
            </div>
          </div>
        )}

        {/* Time slots */}
        <div>
          <h3 className="text-[13px] font-bold text-zinc-900 mb-2.5 flex items-center gap-1.5">
            <Clock size={14} />Choisissez votre créneau de retrait
          </h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {SLOTS.map((s) => (
              <button
                key={s.id}
                disabled={s.full}
                onClick={() => setSelectedSlot(s.id)}
                className={
                  s.full
                    ? "shrink-0 rounded-full px-4 py-2 text-[12px] bg-zinc-100 text-zinc-300 cursor-not-allowed border border-zinc-100"
                    : selectedSlot === s.id
                    ? "chip-active"
                    : "chip"
                }
              >
                {s.label}{s.full && " · Complet"}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        {!hasWeightItems && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-zinc-500">Total</span>
            <span className="text-lg font-extrabold">{formatPrice(totalCents)}</span>
          </div>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-100 bg-white/90 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <span className="text-[13px] font-semibold">{itemCount} article{itemCount > 1 ? "s" : ""}</span>
            <span className="text-lg font-extrabold ml-2">{formatPrice(totalCents)}</span>
          </div>
          <Link href="/checkout" className="px-7 py-3 rounded-full bg-primary text-white text-[13px] font-semibold shadow-md shadow-primary/20 tap-scale hover:bg-primary/90 transition-colors">
            Continuer
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
