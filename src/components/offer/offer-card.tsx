"use client";

import React from "react";
import { Clock, Flame, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

function formatTimeShort(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Expiré";
  const totalMin = Math.round(diffMs / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h${m.toString().padStart(2, "0")}`;
  }
  return `${totalMin} min`;
}

interface OfferCardProps {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  originalCents: number;
  discountCents: number;
  remainingQty: number;
  expiresAt: string;
  isSponsored: boolean;
  shop: { id: string; name: string; slug: string };
  compact?: boolean;
}

export function OfferCard({
  id, name, description, imageUrl, originalCents, discountCents,
  remainingQty, expiresAt, isSponsored, shop, compact,
}: OfferCardProps) {
  const { addItem } = useCart();
  const discount = Math.round(((originalCents - discountCents) / originalCents) * 100);
  const expDate = new Date(expiresAt);
  const isExpired = expDate < new Date();
  const timeLeft = formatTimeShort(expDate);
  const qtyLabel = `${remainingQty} restant${remainingQty > 1 ? "s" : ""}`;

  const handleAdd = () => {
    addItem(
      { id: `offer-${id}`, offerId: id, name, imageUrl, unit: "PIECE", priceCents: discountCents, quantity: 1 },
      shop
    );
  };

  if (compact) {
    return (
      <div className="relative w-[260px] shrink-0 snap-start overflow-hidden rounded-3xl shadow-sm group">
        <div className="relative aspect-[4/3] bg-zinc-200">
          <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="rounded-full bg-primary text-white text-[11px] font-bold px-2.5 py-1 flex items-center gap-1">
              <Flame size={10} />-{discount}%
            </span>
            {isSponsored && (
              <span className="rounded-full bg-white/80 text-zinc-700 text-[10px] font-medium px-2 py-1 border border-zinc-200">
                Sponsorisé
              </span>
            )}
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-3.5">
            <h4 className="text-white text-[13px] font-bold truncate mb-0.5">{name}</h4>
            <p className="text-white/50 text-[11px] truncate mb-2">{shop.name}</p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-white font-bold text-sm">{formatPrice(discountCents)}</span>
                <span className="text-white/40 text-[11px] line-through ml-1.5">{formatPrice(originalCents)}</span>
              </div>
              <button onClick={(e) => { e.preventDefault(); handleAdd(); }} className="rounded-full bg-white text-zinc-900 text-[11px] font-semibold px-3 py-1.5 shadow-sm hover:bg-zinc-100 transition-colors tap-scale">
                Réserver
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-white/40 text-[10px]">
              <span className="flex items-center gap-1"><Clock size={10} />{timeLeft}</span>
              <span>{qtyLabel}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`premium-card p-3 ${isExpired ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-zinc-100 shrink-0">
          <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-1.5 left-1.5 rounded-full bg-primary text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-0.5">
            <Flame size={9} />-{discount}%
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-1.5">
            <h4 className="font-semibold text-[13px] leading-tight truncate">{name}</h4>
            {isSponsored && <span className="shrink-0 rounded-full bg-zinc-100 text-zinc-500 text-[9px] font-medium px-1.5 py-0.5 border border-zinc-200">Sponsorisé</span>}
          </div>
          <p className="text-[11px] text-zinc-500 truncate">{description}</p>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-primary">{formatPrice(discountCents)}</span>
            <span className="text-[11px] text-zinc-400 line-through">{formatPrice(originalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1"><Clock size={10} />{timeLeft}</span>
              <span>{qtyLabel}</span>
            </div>
            {!isExpired && remainingQty > 0 && (
              <Button size="sm" onClick={handleAdd} className="h-7 text-[11px] rounded-full gap-1 px-3">
                <ShoppingBag size={11} />Réserver
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
