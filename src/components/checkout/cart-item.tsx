"use client";

import React from "react";
import { Trash2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart, CartItem as CartItemType } from "@/lib/hooks/use-cart";
import { formatPrice, formatWeight } from "@/lib/utils";

export function CartItemRow({ item }: { item: CartItemType }) {
  const { updateQty, removeItem } = useCart();

  const lineTotal =
    item.unit === "KG" && item.weightGrams
      ? Math.round((item.weightGrams / 1000) * item.priceCents) * item.quantity
      : item.priceCents * item.quantity;

  return (
    <div className="premium-card p-3">
      <div className="flex gap-3">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{item.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                {item.unit === "KG" && item.weightGrams && (
                  <Badge variant="outline" className="text-xs">{formatWeight(item.weightGrams)}</Badge>
                )}
                {item.offerId && (
                  <Badge variant="destructive" className="text-xs">Offre</Badge>
                )}
              </div>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => updateQty(item.id, item.quantity - 1)}
              >
                <Minus size={12} />
              </Button>
              <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => updateQty(item.id, item.quantity + 1)}
              >
                <Plus size={12} />
              </Button>
            </div>
            <span className="font-display font-bold text-sm">{formatPrice(lineTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
