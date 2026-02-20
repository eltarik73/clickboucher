"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { formatPrice, formatWeight } from "@/lib/utils";

// Mock data for weight review
const MOCK_REVIEW = {
  orderId: "order-3",
  orderNumber: "CB-20240615-003",
  shopName: "Boucherie Savoie Tradition",
  items: [
    {
      id: "item-1",
      name: "Entrecôte",
      requestedWeight: 500,
      actualWeight: 560,
      deviationPercent: 12.0,
      originalPriceCents: 1600,
      adjustedPriceCents: 1792,
      needsValidation: true,
    },
  ],
  originalTotal: 3200,
  adjustedTotal: 3584,
  adjustment: 384,
};

export default function ValidationPage(_props: { params: { id: string } }) {
  const [isLoading, setIsLoading] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);

  const review = MOCK_REVIEW;
  const diff = review.adjustedTotal - review.originalTotal;

  const handleAccept = () => {
    setIsLoading(true);
    setTimeout(() => {
      setDecision("accepted");
      setIsLoading(false);
    }, 800);
  };

  const handleReject = () => {
    setIsLoading(true);
    setTimeout(() => {
      setDecision("rejected");
      setIsLoading(false);
    }, 800);
  };

  if (decision) {
    return (
      <PageContainer>
        <header className="sticky top-0 z-40 glass border-b border-border/60">
          <div className="flex items-center gap-3 h-14 px-4">
            <Link href="/commandes" className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="font-display text-subtitle">Validation poids</h1>
          </div>
        </header>

        <div className="px-4 py-12 text-center space-y-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
            decision === "accepted" ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"
          }`}>
            {decision === "accepted" ? (
              <Check size={36} className="text-green-600" />
            ) : (
              <X size={36} className="text-orange-600" />
            )}
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-title">
              {decision === "accepted" ? "Ajustement accepté" : "Ajustement refusé"}
            </h2>
            <p className="text-body text-muted-foreground">
              {decision === "accepted"
                ? "Le nouveau prix a été validé. Votre commande continue sa préparation."
                : "Votre boucher va ajuster la commande ou vous contacter."}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href={`/suivi/${review.orderId}`}>Voir ma commande</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="flex items-center gap-3 h-14 px-4">
          <Link href={`/suivi/${review.orderId}`} className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-subtitle">Validation poids</h1>
            <p className="text-xs text-muted-foreground font-mono">{review.orderNumber}</p>
          </div>
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle size={12} />
            Action requise
          </Badge>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Alert Banner */}
        <div className="flex gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <Scale size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-red-800 dark:text-red-200">
              Écart de poids supérieur à 10%
            </p>
            <p className="text-red-700 dark:text-red-300">
              Le poids réel dépasse de plus de 10% le poids demandé. Votre validation est nécessaire pour continuer.
            </p>
          </div>
        </div>

        {/* Items needing validation */}
        {review.items.filter((i) => i.needsValidation).map((item) => (
          <div key={item.id} className="premium-card p-4 space-y-3">
            <h3 className="font-display font-semibold">{item.name}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted space-y-1">
                <p className="text-xs text-muted-foreground">Demandé</p>
                <p className="font-bold">{formatWeight(item.requestedWeight)}</p>
                <p className="text-sm">{formatPrice(item.originalPriceCents)}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 space-y-1">
                <p className="text-xs text-red-600">Pesé</p>
                <p className="font-bold">{formatWeight(item.actualWeight)}</p>
                <p className="text-sm font-bold text-red-600">{formatPrice(item.adjustedPriceCents)}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <Badge variant="destructive">+{item.deviationPercent.toFixed(1)}%</Badge>
              <span className="text-muted-foreground">soit +{formatPrice(item.adjustedPriceCents - item.originalPriceCents)}</span>
            </div>
          </div>
        ))}

        {/* Total comparison */}
        <div className="premium-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total initial</span>
            <span>{formatPrice(review.originalTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-red-600">
            <span>Ajustement poids</span>
            <span>+{formatPrice(diff)}</span>
          </div>
          <div className="border-t border-border/60 pt-2 flex justify-between font-bold">
            <span>Nouveau total</span>
            <span className="font-display">{formatPrice(review.adjustedTotal)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <Button
            className="w-full h-14 text-base"
            size="lg"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                <Check size={18} className="mr-2" />
                Accepter le nouveau prix
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleReject}
            disabled={isLoading}
          >
            <X size={16} className="mr-2" />
            Refuser — le boucher ajustera
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
