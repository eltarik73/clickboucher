"use client";

import React from "react";
import Image from "next/image";
import { Clock, Flame, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

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
  const timeLeft = formatRelativeTime(expDate);

  const handleAdd = () => {
    addItem(
      {
        id: `offer-${id}`,
        offerId: id,
        name,
        imageUrl,
        unit: "PIECE",
        priceCents: discountCents,
        quantity: 1,
      },
      shop
    );
  };

  if (compact) {
    return (
      <div className="premium-card overflow-hidden flex-shrink-0 w-64 snap-start">
        <div className="relative aspect-[16/10] bg-muted">
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="256px" />
          <Badge variant="destructive" className="absolute top-2 left-2 gap-1">
            <Flame size={12} />
            -{discount}%
          </Badge>
          {isSponsored && (
            <Badge variant="sponsored" className="absolute top-2 right-2">Sponsorisé</Badge>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <h4 className="font-semibold text-sm truncate">{name}</h4>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-primary">{formatPrice(discountCents)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatPrice(originalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} />
              <span>{timeLeft}</span>
            </div>
            <span className="text-xs text-muted-foreground">{remainingQty} restant{remainingQty > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`premium-card p-3 ${isExpired ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="96px" />
          <Badge variant="destructive" className="absolute top-1.5 left-1.5 text-xs gap-0.5">
            <Flame size={10} />
            -{discount}%
          </Badge>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-1">
            <h4 className="font-semibold text-sm leading-tight">{name}</h4>
            {isSponsored && <Badge variant="sponsored" className="text-[10px] flex-shrink-0">Sponsorisé</Badge>}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>

          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-primary">{formatPrice(discountCents)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatPrice(originalCents)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={11} />
                <span>{timeLeft}</span>
              </div>
              <span>{remainingQty} restant{remainingQty > 1 ? "s" : ""}</span>
            </div>
            {!isExpired && remainingQty > 0 && (
              <Button size="sm" onClick={handleAdd} className="h-7 text-xs gap-1">
                <ShoppingBag size={12} />
                Ajouter
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
