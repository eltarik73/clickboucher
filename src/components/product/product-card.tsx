"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Plus, Minus, Scale, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice, formatWeight } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  proPriceCents?: number | null;
  isInStock: boolean;
  stockQty?: number | null;
  weightStep?: number | null;
  minWeight?: number | null;
  isPro?: boolean;
  shop: { id: string; name: string; slug: string };
}

export function ProductCard({
  id, name, description, imageUrl, category, unit,
  priceCents, proPriceCents, isInStock, stockQty,
  weightStep, minWeight, isPro, shop,
}: ProductCardProps) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [weight, setWeight] = useState(minWeight || 500);
  const [showDetail, setShowDetail] = useState(false);

  const price = isPro && proPriceCents ? proPriceCents : priceCents;
  const step = weightStep || 100;

  const handleAdd = () => {
    addItem(
      {
        id: `product-${id}`,
        productId: id,
        name,
        imageUrl,
        unit,
        priceCents: price,
        quantity: qty,
        weightGrams: unit === "KG" ? weight : undefined,
      },
      shop
    );
    setQty(1);
    setWeight(minWeight || 500);
    setShowDetail(false);
  };

  const displayPrice = unit === "KG"
    ? `${formatPrice(price)}/kg`
    : formatPrice(price);

  const lineTotal = unit === "KG"
    ? Math.round((weight / 1000) * price) * qty
    : price * qty;

  return (
    <div className={`premium-card p-3 ${!isInStock ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="80px" />
          {!isInStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs font-bold">Épuisé</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-xs">{category}</Badge>
            {unit === "KG" && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Scale size={11} />
                <span>Au poids</span>
              </div>
            )}
            {unit === "BARQUETTE" && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Package size={11} />
                <span>Barquette</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="font-display font-bold text-sm">{displayPrice}</span>
              {isPro && proPriceCents && (
                <span className="ml-1.5 text-xs text-muted-foreground line-through">
                  {formatPrice(priceCents)}/{unit === "KG" ? "kg" : ""}
                </span>
              )}
            </div>

            {isInStock && (
              <Button
                size="sm"
                variant={showDetail ? "secondary" : "default"}
                onClick={() => unit === "KG" ? setShowDetail(!showDetail) : handleAdd()}
                className="h-8 text-xs"
              >
                {unit === "KG" ? (
                  showDetail ? "Annuler" : "Choisir"
                ) : (
                  <>
                    <Plus size={14} className="mr-0.5" />
                    Ajouter
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Weight selector for KG products */}
      {showDetail && unit === "KG" && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Poids souhaité</span>
            <span className="text-sm font-bold">{formatWeight(weight)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setWeight(Math.max(minWeight || step, weight - step))}
              disabled={weight <= (minWeight || step)}
            >
              <Minus size={14} />
            </Button>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (weight / 3000) * 100)}%` }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setWeight(weight + step)}
            >
              <Plus size={14} />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Produit au poids : ajustement ±10% possible après pesée.
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1}
              >
                <Minus size={14} />
              </Button>
              <span className="text-sm font-bold w-6 text-center">{qty}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setQty(qty + 1)}
              >
                <Plus size={14} />
              </Button>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <ShoppingBag size={14} />
              {formatPrice(lineTotal)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
