"use client";

import { useState } from "react";
import { SEED_ORDERS } from "@/lib/seed/data";
import { Card, Badge, Btn, StatusDot, EmptyState } from "@/components/ui/shared";
import type { Order, OrderStatus } from "@/types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  confirmed: "#E8630A",
  preparing: "#3B82F6",
  ready: "#16A34A",
  picked: "#A8A29E",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: "Confirmée",
  preparing: "En prépa",
  ready: "Prête",
  picked: "Retirée",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "picked",
};

export default function BoucherCommandesPage() {
  const [orders, setOrders] = useState<Order[]>(
    SEED_ORDERS.filter((o) => o.shopId === "cb_savoie_halal_1")
  );

  const advance = (id: string) => {
    setOrders(
      orders.map((o) =>
        o.id === id && NEXT_STATUS[o.status]
          ? { ...o, status: NEXT_STATUS[o.status]! }
          : o
      )
    );
  };

  const active = orders.filter((o) => o.status !== "picked");

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 && (
        <EmptyState icon="✅" title="Aucune commande en cours" />
      )}
      {active.map((o, i) => (
        <Card
          key={o.id}
          className="p-[17px] animate-fade-up"
          style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{o.id}</span>
                <Badge
                  variant="status"
                  className="gap-1.5"
                  style={{
                    backgroundColor: STATUS_COLORS[o.status] + "16",
                    color: STATUS_COLORS[o.status],
                  } as React.CSSProperties}
                >
                  <StatusDot color={STATUS_COLORS[o.status]} />
                  {STATUS_LABELS[o.status]}
                </Badge>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {o.customerName} • Retrait {o.pickupSlot}
              </p>
            </div>
            <span className="text-[15px] font-extrabold">{o.total.toFixed(2)} €</span>
          </div>

          <div className="mt-3 p-3 rounded-[10px] bg-stone-50">
            {o.items.map((it, j) => (
              <p key={j} className="text-xs text-stone-500 leading-relaxed">
                • {it.qty} {it.unit} — {it.name}
              </p>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            {o.status === "confirmed" && (
              <Btn size="sm" onClick={() => advance(o.id)}>
                🔥 Commencer la prépa
              </Btn>
            )}
            {o.status === "preparing" && (
              <Btn size="sm" variant="success" onClick={() => advance(o.id)}>
                ✅ Marquer prête
              </Btn>
            )}
            {o.status === "ready" && (
              <Btn size="sm" variant="secondary" onClick={() => advance(o.id)}>
                📦 Client a retiré
              </Btn>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
