"use client";

import React from "react";
import { Clock, User, Briefcase, Phone, ChevronRight, Scale, AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

export interface OrderRowData {
  id: string;
  orderNumber: string;
  status: string;
  clientName: string;
  clientPhone: string;
  isPro: boolean;
  companyName?: string;
  itemCount: number;
  totalCents: number;
  hasWeightItems: boolean;
  paymentMethod: string;
  createdAt: string;
  estimatedReadyAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Nouvelle", color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200" },
  ACCEPTED: { label: "Acceptée", color: "text-green-700", bg: "bg-green-50 dark:bg-green-950/30 border-green-200" },
  PREPARING: { label: "En prépa", color: "text-yellow-700", bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200" },
  WEIGHING: { label: "Pesée", color: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200" },
  WEIGHT_REVIEW: { label: "Attente client", color: "text-red-700", bg: "bg-red-50 dark:bg-red-950/30 border-red-200" },
  STOCK_ISSUE: { label: "Rupture", color: "text-red-700", bg: "bg-red-50 dark:bg-red-950/30 border-red-200" },
  READY: { label: "Prête", color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200" },
  COLLECTED: { label: "Retirée", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-900/30 border-gray-200" },
  CANCELLED: { label: "Annulée", color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-900/30 border-gray-200" },
};

const NEXT_ACTION: Record<string, { label: string; status: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  PENDING: { label: "Accepter", status: "ACCEPTED", variant: "default" },
  ACCEPTED: { label: "Préparer", status: "PREPARING", variant: "default" },
  PREPARING: { label: "Pesée", status: "WEIGHING", variant: "default" },
  READY: { label: "Retirée", status: "COLLECTED", variant: "default" },
};

interface OrderRowProps {
  order: OrderRowData;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onSelect: (orderId: string) => void;
}

export function OrderRow({ order, onStatusChange, onSelect }: OrderRowProps) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const nextAction = NEXT_ACTION[order.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(order.id); }}
      className={`rounded-2xl border p-3.5 transition-all ${config.bg} cursor-pointer`}
      onClick={() => onSelect(order.id)}
    >
      {/* Row 1: Order # + Status + Total */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold">{order.orderNumber}</span>
          <Badge variant="outline" className={`${config.color} border-current text-xs`}>
            {config.label}
          </Badge>
        </div>
        <span className="font-display font-bold text-sm">{formatPrice(order.totalCents)}</span>
      </div>

      {/* Row 2: Client + Items */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          {order.isPro ? (
            <div className="flex items-center gap-1">
              <Briefcase size={13} className="text-primary" />
              <span className="font-medium">{order.companyName || order.clientName}</span>
              <Badge variant="default" className="text-[10px] h-4">PRO</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <User size={13} className="text-muted-foreground" />
              <span>{order.clientName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{order.itemCount} art.</span>
          {order.hasWeightItems && <Scale size={12} className="text-orange-500" />}
        </div>
      </div>

      {/* Row 3: Time + Payment + Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{formatRelativeTime(new Date(order.createdAt))}</span>
          <span>·</span>
          <span>
            {order.paymentMethod === "CB_ONLINE" ? "CB" : order.paymentMethod === "CASH" ? "Espèces" : order.paymentMethod === "PRO_ACCOUNT" ? "Compte PRO" : "CB retrait"}
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {order.status === "PENDING" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive border-destructive/30"
              onClick={() => onStatusChange(order.id, "CANCELLED")}
            >
              Refuser
            </Button>
          )}
          {nextAction && (
            <Button
              variant={nextAction.variant}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onStatusChange(order.id, nextAction.status)}
            >
              {nextAction.label}
            </Button>
          )}
          {order.status === "STOCK_ISSUE" && (
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1">
              <AlertTriangle size={11} />
              Résoudre
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
