"use client";

import React from "react";
import { ArrowLeft, User, Briefcase, Phone, CreditCard, Clock, Scale, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/order/order-timeline";
import { formatPrice, formatWeight, formatRelativeTime } from "@/lib/utils";

interface OrderDetailItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  requestedWeight?: number;
  actualWeight?: number;
  weightDeviation?: number;
  unitPriceCents: number;
  totalPriceCents: number;
  adjustedPriceCents?: number;
  needsValidation?: boolean;
  stockAction?: string;
}

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  detail?: string | null;
  createdAt: string;
}

interface OrderDetailProps {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    clientName: string;
    clientPhone: string;
    isPro: boolean;
    companyName?: string;
    items: OrderDetailItem[];
    totalCents: number;
    weightAdjCents: number;
    paymentMethod: string;
    paymentStatus: string;
    timeline: TimelineEvent[];
    createdAt: string;
  };
  onBack: () => void;
  onStatusChange: (status: string) => void;
  onStartWeighing: () => void;
  onOpenStockIssue: () => void;
}

export function OrderDetail({ order, onBack, onStatusChange, onStartWeighing, onOpenStockIssue }: OrderDetailProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button aria-label="Retour" onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-bold text-base">{order.orderNumber}</h2>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(order.createdAt))}</p>
        </div>
        <Badge variant="outline" className="text-xs">{order.status}</Badge>
      </div>

      {/* Client Info */}
      <div className="premium-card p-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${order.isPro ? "bg-primary/10" : "bg-muted"}`}>
          {order.isPro ? <Briefcase size={18} className="text-primary" /> : <User size={18} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">{order.clientName}</span>
            {order.isPro && <Badge variant="default" className="text-[10px] h-4">PRO</Badge>}
          </div>
          {order.companyName && <p className="text-xs text-muted-foreground">{order.companyName}</p>}
        </div>
        <a href={`tel:${order.clientPhone}`} className="p-2 rounded-full bg-muted hover:bg-muted/70">
          <Phone size={16} />
        </a>
      </div>

      {/* Items */}
      <div className="premium-card p-3 space-y-2">
        <h3 className="font-display font-semibold text-sm">Articles</h3>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm py-1 border-b border-border/30 last:border-0">
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span>{item.name}</span>
                <span className="text-muted-foreground">×{item.quantity}</span>
                {item.unit === "KG" && item.requestedWeight && (
                  <Badge variant="outline" className="text-[10px]">
                    <Scale size={9} className="mr-0.5" />
                    {formatWeight(item.requestedWeight)}
                  </Badge>
                )}
              </div>
              {item.actualWeight && (
                <p className="text-xs mt-0.5">
                  <span className="text-muted-foreground">Pesé : </span>
                  <span className={`font-bold ${item.weightDeviation && Math.abs(item.weightDeviation) > 10 ? "text-red-600" : "text-green-600"}`}>
                    {formatWeight(item.actualWeight)}
                    {item.weightDeviation && ` (${item.weightDeviation > 0 ? "+" : ""}${item.weightDeviation}%)`}
                  </span>
                </p>
              )}
              {item.stockAction && (
                <Badge variant="destructive" className="text-[10px] mt-0.5">{item.stockAction}</Badge>
              )}
            </div>
            <div className="text-right">
              <span>{formatPrice(item.adjustedPriceCents || item.totalPriceCents)}</span>
              {item.adjustedPriceCents && item.adjustedPriceCents !== item.totalPriceCents && (
                <p className="text-xs text-muted-foreground line-through">{formatPrice(item.totalPriceCents)}</p>
              )}
            </div>
          </div>
        ))}
        <div className="flex justify-between font-bold pt-1">
          <span>Total</span>
          <span className="font-display">{formatPrice(order.totalCents)}</span>
        </div>
        {order.weightAdjCents !== 0 && (
          <p className="text-xs text-muted-foreground">
            Ajustement poids : {order.weightAdjCents > 0 ? "+" : ""}{formatPrice(order.weightAdjCents)}
          </p>
        )}
      </div>

      {/* Payment */}
      <div className="premium-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <CreditCard size={14} className="text-muted-foreground" />
          <span>
            {order.paymentMethod === "CB_ONLINE" ? "CB en ligne" : order.paymentMethod === "CASH" ? "Espèces" : order.paymentMethod === "PRO_ACCOUNT" ? "Compte PRO" : "CB retrait"}
          </span>
        </div>
        <Badge variant={order.paymentStatus === "COMPLETED" ? "success" : order.paymentStatus === "PENDING" ? "warning" : "secondary"} className="text-xs">
          {order.paymentStatus === "COMPLETED" ? "Payé" : order.paymentStatus === "PENDING" ? "En attente" : order.paymentStatus}
        </Badge>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {order.status === "PENDING" && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onStatusChange("CANCELLED")}>Refuser</Button>
            <Button className="flex-1" onClick={() => onStatusChange("ACCEPTED")}>Accepter</Button>
          </div>
        )}
        {order.status === "ACCEPTED" && (
          <Button className="w-full" onClick={() => onStatusChange("PREPARING")}>
            <Package size={16} className="mr-1" /> Commencer la préparation
          </Button>
        )}
        {order.status === "PREPARING" && (
          <div className="flex gap-2">
            {order.items.some((i) => i.unit === "KG") && (
              <Button className="flex-1" onClick={onStartWeighing}>
                <Scale size={16} className="mr-1" /> Pesée
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onOpenStockIssue}>
              Rupture stock
            </Button>
            {!order.items.some((i) => i.unit === "KG") && (
              <Button className="flex-1" onClick={() => onStatusChange("READY")}>
                Commande prête
              </Button>
            )}
          </div>
        )}
        {order.status === "READY" && (
          <Button variant="success" className="w-full" onClick={() => onStatusChange("COLLECTED")}>
            <Package size={16} className="mr-1" /> Marquer comme retirée
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="premium-card p-3">
        <h3 className="font-display font-semibold text-sm mb-3">Historique</h3>
        <OrderTimeline events={order.timeline} />
      </div>
    </div>
  );
}
