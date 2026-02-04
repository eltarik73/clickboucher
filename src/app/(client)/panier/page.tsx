"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Trash2, Info, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { CartItemRow } from "@/components/checkout/cart-item";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

export default function PanierPage() {
  const { state, itemCount, totalCents, clear } = useCart();
  const isEmpty = state.items.length === 0;
  const hasWeightItems = state.items.some((i) => i.unit === "KG");

  return (
    <PageContainer padBottom={false}>
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link href={state.shopSlug ? `/boutique/${state.shopSlug}` : "/decouvrir"} className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-subtitle">Panier</h1>
              {state.shopName && (
                <p className="text-xs text-muted-foreground">{state.shopName}</p>
              )}
            </div>
          </div>
          {!isEmpty && (
            <button onClick={clear} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
              Vider
            </button>
          )}
        </div>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={<ShoppingBag size={28} strokeWidth={1.5} />}
          title="Votre panier est vide"
          description="Ajoutez des produits depuis une boucherie pour commencer."
          action={
            <Button asChild>
              <Link href="/decouvrir">Découvrir les boucheries</Link>
            </Button>
          }
        />
      ) : (
        <div className="px-4 py-4 pb-48 space-y-3">
          {/* Cart Items */}
          {state.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}

          {/* Weight Disclaimer */}
          {hasWeightItems && (
            <div className="flex gap-2.5 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <Scale size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-orange-800 dark:text-orange-200 space-y-1">
                <p className="font-semibold">Produits au poids</p>
                <p>Le prix final peut varier de ±10% après pesée. Au-delà de +10%, votre validation sera demandée.</p>
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="premium-card p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Articles ({itemCount})</span>
                <span>{formatPrice(totalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retrait en boutique</span>
                <span className="text-green-600 font-medium">Gratuit</span>
              </div>
              {hasWeightItems && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Info size={11} />
                    Ajustement possible après pesée
                  </span>
                  <span className="text-muted-foreground">±10%</span>
                </div>
              )}
            </div>
            <div className="border-t border-border/60 pt-3 flex justify-between items-center">
              <span className="font-display font-bold">Total estimé</span>
              <span className="font-display text-subtitle font-bold">{formatPrice(totalCents)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Checkout CTA */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-0 right-0 glass border-t border-border/60 p-4 pb-safe-bottom">
          <div className="mx-auto max-w-lg">
            <Button className="w-full h-14 text-base gap-2 shadow-elevated" size="lg" asChild>
              <Link href="/checkout">
                Commander
                <span className="ml-auto font-display font-bold">{formatPrice(totalCents)}</span>
              </Link>
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
