"use client";

import React, { useState } from "react";
import { Bell, Package, AlertTriangle, Clock, Check, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TogglePill } from "@/components/ui/toggle-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderRow, OrderRowData } from "@/components/boucher/order-row";
import { OrderDetail } from "@/components/boucher/order-detail";
import { WeighingPanel } from "@/components/boucher/weighing-panel";
import { StockIssueWizard } from "@/components/boucher/stock-issue-wizard";
import { UNSPLASH } from "@/lib/utils";

// ── Mock Orders ──────────────────────────────

const MOCK_ORDERS: OrderRowData[] = [
  { id: "o7", orderNumber: "CB-20240615-007", status: "PENDING", clientName: "Invité", clientPhone: "+33699887766", isPro: false, itemCount: 1, totalCents: 1490, hasWeightItems: false, paymentMethod: "CASH", createdAt: new Date(Date.now() - 2 * 60_000).toISOString() },
  { id: "o1", orderNumber: "CB-20240615-001", status: "READY", clientName: "Marie Dupont", clientPhone: "+33612345678", isPro: false, itemCount: 2, totalCents: 4580, hasWeightItems: true, paymentMethod: "CB_ONLINE", createdAt: new Date(Date.now() - 45 * 60_000).toISOString() },
  { id: "o2", orderNumber: "CB-20240615-002", status: "PREPARING", clientName: "Bob Burger", clientPhone: "+33698765432", isPro: true, companyName: "Bob's Burgers SARL", itemCount: 2, totalCents: 17850, hasWeightItems: true, paymentMethod: "PRO_ACCOUNT", createdAt: new Date(Date.now() - 60 * 60_000).toISOString() },
  { id: "o3", orderNumber: "CB-20240615-003", status: "WEIGHT_REVIEW", clientName: "Pierre Martin", clientPhone: "+33623456789", isPro: false, itemCount: 1, totalCents: 3584, hasWeightItems: true, paymentMethod: "CB_ONLINE", createdAt: new Date(Date.now() - 20 * 60_000).toISOString() },
  { id: "o4", orderNumber: "CB-20240615-004", status: "STOCK_ISSUE", clientName: "Sophie Moreau", clientPhone: "+33634567890", isPro: false, itemCount: 1, totalCents: 2370, hasWeightItems: false, paymentMethod: "CB_ONLINE", createdAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: "o5", orderNumber: "CB-20240614-005", status: "COLLECTED", clientName: "Alain Ducasse", clientPhone: "+33645678901", isPro: true, companyName: "Le Chalet Savoyard", itemCount: 2, totalCents: 6720, hasWeightItems: false, paymentMethod: "PRO_ACCOUNT", createdAt: new Date(Date.now() - 24 * 3600_000).toISOString() },
  { id: "o6", orderNumber: "CB-20240614-006", status: "CANCELLED", clientName: "Lucas Bernard", clientPhone: "+33656789012", isPro: false, itemCount: 2, totalCents: 1580, hasWeightItems: false, paymentMethod: "CB_ONLINE", createdAt: new Date(Date.now() - 48 * 3600_000).toISOString() },
];

const MOCK_ORDER_DETAIL = {
  id: "o2",
  orderNumber: "CB-20240615-002",
  status: "PREPARING",
  clientName: "Bob Burger",
  clientPhone: "+33698765432",
  isPro: true,
  companyName: "Bob's Burgers SARL",
  items: [
    { id: "oi1", name: "Côte de bœuf", quantity: 5, unit: "KG", requestedWeight: 1200, unitPriceCents: 3800, totalPriceCents: 22800 },
    { id: "oi2", name: "Rôti de veau", quantity: 1, unit: "KG", requestedWeight: 3000, unitPriceCents: 2800, totalPriceCents: 8400 },
  ],
  totalCents: 17850,
  weightAdjCents: 0,
  paymentMethod: "PRO_ACCOUNT",
  paymentStatus: "PENDING",
  timeline: [
    { id: "t1", status: "PENDING", message: "Commande passée", createdAt: new Date(Date.now() - 60 * 60_000).toISOString() },
    { id: "t2", status: "ACCEPTED", message: "Commande acceptée", createdAt: new Date(Date.now() - 55 * 60_000).toISOString() },
    { id: "t3", status: "PREPARING", message: "Préparation en cours", createdAt: new Date(Date.now() - 50 * 60_000).toISOString() },
  ],
  createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
};

type View = "list" | "detail" | "weighing" | "stock-issue";
type Filter = "all" | "active" | "pending" | "done";

export default function BoucherCommandesPage() {
  const [filter, setFilter] = useState<Filter>("active");
  const [view, setView] = useState<View>("list");
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    if (filter === "active") return !["COLLECTED", "CANCELLED"].includes(o.status);
    if (filter === "pending") return o.status === "PENDING";
    if (filter === "done") return ["COLLECTED", "CANCELLED"].includes(o.status);
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const urgentCount = orders.filter((o) => ["WEIGHT_REVIEW", "STOCK_ISSUE"].includes(o.status)).length;

  const handleStatusChange = (orderId: string, newStatus: string) => {
    setOrders(orders.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handleSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    setView("detail");
  };

  // Detail / Weighing / Stock Issue views
  if (view === "detail" && selectedOrderId) {
    return (
      <div className="px-4 py-4">
        <OrderDetail
          order={MOCK_ORDER_DETAIL}
          onBack={() => setView("list")}
          onStatusChange={(status) => {
            handleStatusChange(selectedOrderId, status);
            setView("list");
          }}
          onStartWeighing={() => setView("weighing")}
          onOpenStockIssue={() => setView("stock-issue")}
        />
      </div>
    );
  }

  if (view === "weighing" && selectedOrderId) {
    return (
      <div className="px-4 py-4">
        <WeighingPanel
          orderId={selectedOrderId}
          orderNumber={MOCK_ORDER_DETAIL.orderNumber}
          items={MOCK_ORDER_DETAIL.items.filter((i) => i.unit === "KG").map((i) => ({
            id: i.id,
            name: i.name,
            requestedWeight: i.requestedWeight!,
            unitPriceCents: i.unitPriceCents,
          }))}
          onSubmit={(results) => {
            const hasExceeding = results.some((r) => r.exceeds);
            handleStatusChange(selectedOrderId, hasExceeding ? "WEIGHT_REVIEW" : "READY");
            setView("list");
          }}
          onCancel={() => setView("detail")}
        />
      </div>
    );
  }

  if (view === "stock-issue" && selectedOrderId) {
    return (
      <div className="px-4 py-4">
        <StockIssueWizard
          orderId={selectedOrderId}
          orderNumber={MOCK_ORDER_DETAIL.orderNumber}
          items={[
            { id: "oi1", name: "Paupiettes de veau", quantity: 4, availableQty: 2, unitPriceCents: 590 },
          ]}
          onResolve={(itemId, action, replacement) => {
            console.log(`Resolved: ${itemId} → ${action}`, replacement);
          }}
          onClose={() => {
            handleStatusChange(selectedOrderId, "PREPARING");
            setView("list");
          }}
        />
      </div>
    );
  }

  // ── List View ──────────────────────────────

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Stats Banner */}
      <div className="flex gap-2">
        {pendingCount > 0 && (
          <div className="flex-1 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-center">
            <p className="text-2xl font-display font-bold text-blue-700">{pendingCount}</p>
            <p className="text-xs text-blue-600">Nouvelle{pendingCount > 1 ? "s" : ""}</p>
          </div>
        )}
        {urgentCount > 0 && (
          <div className="flex-1 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-center">
            <p className="text-2xl font-display font-bold text-red-700">{urgentCount}</p>
            <p className="text-xs text-red-600">Urgent{urgentCount > 1 ? "es" : "e"}</p>
          </div>
        )}
        <div className="flex-1 p-3 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-center">
          <p className="text-2xl font-display font-bold text-green-700">
            {orders.filter((o) => !["COLLECTED", "CANCELLED"].includes(o.status)).length}
          </p>
          <p className="text-xs text-green-600">En cours</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        <TogglePill active={filter === "active"} onClick={() => setFilter("active")} label="En cours" />
        <TogglePill active={filter === "pending"} onClick={() => setFilter("pending")} label={`Nouvelles (${pendingCount})`} />
        <TogglePill active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" />
        <TogglePill active={filter === "done"} onClick={() => setFilter("done")} label="Terminées" />
      </div>

      {/* Order List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={28} strokeWidth={1.5} />}
          title="Aucune commande"
          description={filter === "pending" ? "Aucune nouvelle commande en attente." : "Aucune commande pour ce filtre."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
