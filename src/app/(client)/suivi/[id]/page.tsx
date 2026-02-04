"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Clock, Package, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { OrderTimeline } from "@/components/order/order-timeline";
import { formatPrice } from "@/lib/utils";

// Mock order for demo
const MOCK_ORDER = {
  id: "order-1",
  orderNumber: "CB-20240615-001",
  status: "PREPARING" as const,
  shop: { name: "Boucherie Savoie Tradition", address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34" },
  items: [
    { id: "i1", name: "Entrecôte", quantity: 2, unit: "KG", requestedWeight: 500, unitPriceCents: 3200, totalPriceCents: 3200 },
    { id: "i2", name: "Merguez maison", quantity: 1, unit: "BARQUETTE", unitPriceCents: 890, totalPriceCents: 890 },
  ],
  totalCents: 4090,
  paymentMethod: "CB_ONLINE",
  estimatedReadyAt: new Date(Date.now() + 12 * 60_000).toISOString(),
  timeline: [
    { id: "t1", status: "PENDING", message: "Commande passée", createdAt: new Date(Date.now() - 8 * 60_000).toISOString() },
    { id: "t2", status: "ACCEPTED", message: "Commande acceptée par le boucher", createdAt: new Date(Date.now() - 6 * 60_000).toISOString() },
    { id: "t3", status: "PREPARING", message: "Préparation en cours", createdAt: new Date(Date.now() - 4 * 60_000).toISOString() },
  ],
};

const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  PENDING: { label: "En attente", color: "bg-blue-500", description: "Votre commande a été transmise au boucher." },
  ACCEPTED: { label: "Acceptée", color: "bg-green-500", description: "Le boucher a accepté votre commande." },
  PREPARING: { label: "En préparation", color: "bg-yellow-500", description: "Votre commande est en cours de préparation." },
  WEIGHING: { label: "Pesée", color: "bg-orange-500", description: "Les produits au poids sont en cours de pesée." },
  WEIGHT_REVIEW: { label: "Validation requise", color: "bg-red-500", description: "Le poids dépasse +10%. Merci de valider." },
  STOCK_ISSUE: { label: "Rupture de stock", color: "bg-red-500", description: "Un produit n'est plus disponible." },
  READY: { label: "Prête !", color: "bg-green-600", description: "Votre commande est prête. Rendez-vous au comptoir !" },
  COLLECTED: { label: "Retirée", color: "bg-green-700", description: "Commande retirée. Bon appétit !" },
  CANCELLED: { label: "Annulée", color: "bg-gray-500", description: "Cette commande a été annulée." },
};

export default function SuiviPage({ params }: { params: { id: string } }) {
  const order = MOCK_ORDER;
  const status = STATUS_LABELS[order.status] || STATUS_LABELS.PENDING;
  const minutesLeft = Math.max(0, Math.round((new Date(order.estimatedReadyAt).getTime() - Date.now()) / 60_000));

  return (
    <PageContainer>
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="flex items-center gap-3 h-14 px-4">
          <Link href="/commandes" className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-subtitle">Suivi commande</h1>
            <p className="text-xs text-muted-foreground font-mono">{order.orderNumber}</p>
          </div>
          <Badge className={`${status.color} text-white border-0`}>{status.label}</Badge>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Status Card */}
        <div className="premium-card p-5 text-center space-y-3">
          <div className={`w-14 h-14 rounded-full ${status.color} text-white flex items-center justify-center mx-auto`}>
            {order.status === "READY" ? <Package size={24} /> : order.status === "WEIGHT_REVIEW" ? <AlertTriangle size={24} /> : <Clock size={24} />}
          </div>
          <h2 className="font-display text-title">{status.label}</h2>
          <p className="text-body text-muted-foreground">{status.description}</p>
          {order.status === "PREPARING" && minutesLeft > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-sm font-medium">
              <Clock size={14} className="text-primary" />
              <span>Prête dans ~{minutesLeft} min</span>
            </div>
          )}
          {order.status === "WEIGHT_REVIEW" && (
            <Button variant="destructive" className="mt-2" asChild>
              <Link href={`/validation/${order.id}`}>Valider l&apos;ajustement</Link>
            </Button>
          )}
        </div>

        {/* Shop Info */}
        <div className="premium-card p-4 space-y-2">
          <h3 className="font-display font-semibold text-sm">{order.shop.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={13} />
            <span>{order.shop.address}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone size={13} />
            <span>{order.shop.phone}</span>
          </div>
        </div>

        {/* Items */}
        <div className="premium-card p-4 space-y-2.5">
          <h3 className="font-display font-semibold text-sm">Articles</h3>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <div>
                <span>{item.name}</span>
                <span className="text-muted-foreground ml-1">x{item.quantity}</span>
                {item.unit === "KG" && item.requestedWeight && (
                  <span className="text-xs text-muted-foreground ml-1">({item.requestedWeight}g)</span>
                )}
              </div>
              <span>{formatPrice(item.totalPriceCents)}</span>
            </div>
          ))}
          <div className="border-t border-border/60 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="font-display">{formatPrice(order.totalCents)}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="premium-card p-4">
          <h3 className="font-display font-semibold text-sm mb-4">Historique</h3>
          <OrderTimeline events={order.timeline} />
        </div>
      </div>
    </PageContainer>
  );
}
