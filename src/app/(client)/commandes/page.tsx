"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Clock, Check, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TogglePill } from "@/components/ui/toggle-pill";
import { ClientHeader } from "@/components/layout/client-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatRelativeTime, UNSPLASH } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; dot?: string }> = {
  PENDING: { label: "En attente", variant: "secondary", dot: "bg-blue-500" },
  ACCEPTED: { label: "Acceptée", variant: "outline", dot: "bg-green-500" },
  PREPARING: { label: "En préparation", variant: "warning", dot: "bg-yellow-500 animate-pulse" },
  WEIGHING: { label: "Pesée", variant: "warning", dot: "bg-orange-500" },
  WEIGHT_REVIEW: { label: "Validation requise", variant: "destructive", dot: "bg-red-500 animate-pulse" },
  STOCK_ISSUE: { label: "Rupture stock", variant: "destructive" },
  READY: { label: "Prête", variant: "success", dot: "bg-green-600" },
  COLLECTED: { label: "Retirée", variant: "secondary" },
  CANCELLED: { label: "Annulée", variant: "secondary" },
};

const MOCK_ORDERS = [
  {
    id: "order-1", orderNumber: "CB-20240615-001", status: "READY",
    shopName: "Boucherie Savoie Tradition", shopImage: UNSPLASH.shops[0],
    totalCents: 4580, itemCount: 3, createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
  {
    id: "order-2", orderNumber: "CB-20240615-002", status: "PREPARING",
    shopName: "Boucherie Savoie Tradition", shopImage: UNSPLASH.shops[0],
    totalCents: 17850, itemCount: 2, createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
  },
  {
    id: "order-3", orderNumber: "CB-20240615-003", status: "WEIGHT_REVIEW",
    shopName: "Boucherie Savoie Tradition", shopImage: UNSPLASH.shops[0],
    totalCents: 3200, itemCount: 1, createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    id: "order-5", orderNumber: "CB-20240614-005", status: "COLLECTED",
    shopName: "Boucherie Savoie Tradition", shopImage: UNSPLASH.shops[0],
    totalCents: 6720, itemCount: 5, createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
  },
  {
    id: "order-6", orderNumber: "CB-20240614-006", status: "CANCELLED",
    shopName: "Maison Perrin", shopImage: UNSPLASH.shops[1],
    totalCents: 1580, itemCount: 2, createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
  },
];

type Filter = "all" | "active" | "done";

export default function CommandesPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = MOCK_ORDERS.filter((o) => {
    if (filter === "active") return !["COLLECTED", "CANCELLED"].includes(o.status);
    if (filter === "done") return ["COLLECTED", "CANCELLED"].includes(o.status);
    return true;
  });

  return (
    <PageContainer>
      <ClientHeader title="Commandes" showLocation={false} />

      <div className="flex gap-2 px-4 py-3">
        <TogglePill active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" />
        <TogglePill active={filter === "active"} onClick={() => setFilter("active")} label="En cours" />
        <TogglePill active={filter === "done"} onClick={() => setFilter("done")} label="Terminées" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={28} strokeWidth={1.5} />}
          title="Aucune commande"
          description="Vos commandes apparaîtront ici."
          action={<Button asChild><Link href="/decouvrir">Découvrir</Link></Button>}
        />
      ) : (
        <div className="px-4 pb-6 space-y-3">
          {filtered.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const href = order.status === "WEIGHT_REVIEW"
              ? `/validation/${order.id}`
              : `/suivi/${order.id}`;

            return (
              <Link key={order.id} href={href} className="block premium-card p-3.5 tap-scale">
                <div className="flex gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    <Image src={order.shopImage} alt={order.shopName} fill className="object-cover" sizes="56px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{order.shopName}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{order.orderNumber}</p>
                      </div>
                      <Badge variant={config.variant} className="flex-shrink-0 gap-1">
                        {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{order.itemCount} article{order.itemCount > 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(new Date(order.createdAt))}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-display font-bold text-sm">{formatPrice(order.totalCents)}</span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                    {order.status === "WEIGHT_REVIEW" && (
                      <div className="mt-2">
                        <Button variant="destructive" size="sm" className="h-7 text-xs w-full">
                          <AlertTriangle size={12} className="mr-1" />
                          Valider l&apos;ajustement poids
                        </Button>
                      </div>
                    )}
                    {order.status === "READY" && (
                      <div className="mt-2">
                        <Button variant="success" size="sm" className="h-7 text-xs w-full">
                          <Check size={12} className="mr-1" />
                          Prête — Allez au comptoir
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
