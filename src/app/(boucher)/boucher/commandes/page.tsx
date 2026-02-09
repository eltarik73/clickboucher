"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRScanner } from "@/components/boucher/QRScanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChefHat,
  QrCode,
  ScanLine,
  Package,
  Timer,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  available: boolean;
  product: { name: string; unit: string };
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  isPro: boolean;
  customerNote: string | null;
  requestedTime: string | null;
  estimatedReady: string | null;
  actualReady: string | null;
  qrCode: string | null;
  createdAt: string;
  items: OrderItem[];
  user: { firstName: string; lastName: string } | null;
};

type Tab = "nouvelles" | "en-cours" | "pretes";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20ac";
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

function timeRemaining(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const mins = Math.ceil(diff / 60_000);
  return mins;
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BoucherCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopPrepTime, setShopPrepTime] = useState(15);
  const [activeTab, setActiveTab] = useState<Tab>("nouvelles");
  const [loading, setLoading] = useState(true);
  const prevPendingIds = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Actions state ──
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptMinutes, setAcceptMinutes] = useState(15);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [stockIssueId, setStockIssueId] = useState<string | null>(null);
  const [unavailableItems, setUnavailableItems] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // ── Init audio ──
  useEffect(() => {
    audioRef.current = new Audio("/notification.wav");
  }, []);

  // ── Fetch orders ──
  const fetchOrders = useCallback(async (isPolling = false) => {
    try {
      const [ordersRes, shopRes] = await Promise.all([
        fetch("/api/orders"),
        !isPolling ? fetch("/api/shops/my-shop") : Promise.resolve(null),
      ]);

      if (ordersRes.ok) {
        const json = await ordersRes.json();
        const fetched: Order[] = json.data || [];
        setOrders(fetched);

        // Check for new PENDING orders → play notification
        const currentPendingIds = new Set(
          fetched.filter((o) => o.status === "PENDING").map((o) => o.id)
        );
        if (isPolling && prevPendingIds.current.size > 0) {
          const hasNew = [...currentPendingIds].some(
            (id) => !prevPendingIds.current.has(id)
          );
          if (hasNew) {
            audioRef.current?.play().catch(() => {});
          }
        }
        prevPendingIds.current = currentPendingIds;
      }

      if (shopRes && shopRes.ok) {
        const shopJson = await shopRes.json();
        setShopPrepTime(shopJson.data?.prepTimeMin || 15);
        setAcceptMinutes(shopJson.data?.prepTimeMin || 15);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => fetchOrders(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ── Actions ──
  async function handleAccept(orderId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedMinutes: acceptMinutes }),
      });
      if (res.ok) {
        setAcceptingId(null);
        await fetchOrders(true);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeny(orderId: string) {
    if (!denyReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denyReason }),
      });
      if (res.ok) {
        setDenyingId(null);
        setDenyReason("");
        await fetchOrders(true);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStockIssue(orderId: string) {
    if (unavailableItems.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/stock-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unavailableItems: [...unavailableItems] }),
      });
      if (res.ok) {
        setStockIssueId(null);
        setUnavailableItems(new Set());
        await fetchOrders(true);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePreparing(orderId: string, addMinutes?: number) {
    setActionLoading(true);
    try {
      await fetch(`/api/orders/${orderId}/preparing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addMinutes: addMinutes || 0 }),
      });
      await fetchOrders(true);
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReady(orderId: string) {
    setActionLoading(true);
    try {
      await fetch(`/api/orders/${orderId}/ready`, {
        method: "POST",
      });
      await fetchOrders(true);
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePickedUp(orderId: string, qrCode: string | null) {
    setActionLoading(true);
    try {
      await fetch(`/api/orders/${orderId}/picked-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: qrCode || "" }),
      });
      await fetchOrders(true);
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  }

  // ── Filter orders by tab ──
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const inProgressOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "PREPARING"
  );
  const readyOrders = orders.filter((o) => o.status === "READY");

  const tabs: { key: Tab; label: string; count: number; icon: typeof Bell }[] = [
    { key: "nouvelles", label: "Nouvelles", count: pendingOrders.length, icon: Bell },
    { key: "en-cours", label: "En cours", count: inProgressOrders.length, icon: Clock },
    { key: "pretes", label: "Prêtes", count: readyOrders.length, icon: CheckCircle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b2500]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#1a1814]">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white dark:bg-[#2a2520] rounded-xl p-1 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#8b2500] text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#3a3530]"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#8b2500] text-white"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── NOUVELLES ── */}
        {activeTab === "nouvelles" && (
          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <EmptyTab icon={<Bell className="w-10 h-10 text-gray-300 dark:text-gray-600" />} message="Aucune nouvelle commande" />
            ) : (
              pendingOrders.map((order) => (
                <Card key={order.id} className="bg-white dark:bg-[#2a2520] border-0 shadow-sm overflow-hidden">
                  <div className="h-1 bg-amber-400" />
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-gray-900 dark:text-[#f8f6f3]">
                            {order.orderNumber}
                          </span>
                          {order.isPro && (
                            <Badge variant="pro" className="text-[10px]">PRO</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {order.user ? `${order.user.firstName} ${order.user.lastName}` : "Client"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-[#f8f6f3]">
                          {formatPrice(order.totalCents)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(order.createdAt)}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-gray-50 dark:bg-[#1a1814] rounded-lg p-3 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">
                            {item.quantity} {item.product.unit === "KG" ? "kg" : item.product.unit === "PIECE" ? "pc" : "barq."} — {item.product.name}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500 text-xs">
                            {formatPrice(item.unitPriceCents * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Customer note */}
                    {order.customerNote && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                        <span className="font-medium">Note : </span>{order.customerNote}
                      </div>
                    )}

                    {/* Requested time */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Clock size={13} />
                      {order.requestedTime
                        ? `Retrait souhaité : ${formatTime(order.requestedTime)}`
                        : "ASAP"}
                    </div>

                    {/* ── Accept form ── */}
                    {acceptingId === order.id ? (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          Prêt dans combien de minutes ?
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={acceptMinutes}
                            onChange={(e) => setAcceptMinutes(Number(e.target.value))}
                            className="w-24 h-9"
                            min={1}
                            max={480}
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
                          <div className="flex-1" />
                          <Button
                            size="sm"
                            onClick={() => handleAccept(order.id)}
                            disabled={actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Confirmer"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAcceptingId(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : denyingId === order.id ? (
                      /* ── Deny form ── */
                      <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          Raison du refus
                        </p>
                        <textarea
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                          placeholder="Ex: Rupture de stock, fermeture exceptionnelle..."
                          className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-[#1a1814] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 dark:text-[#f8f6f3]"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeny(order.id)}
                            disabled={actionLoading || !denyReason.trim()}
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Confirmer le refus"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setDenyingId(null); setDenyReason(""); }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : stockIssueId === order.id ? (
                      /* ── Stock issue form ── */
                      <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                          Cochez les articles en rupture
                        </p>
                        <div className="space-y-1.5">
                          {order.items.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={unavailableItems.has(item.productId)}
                                onChange={(e) => {
                                  const next = new Set(unavailableItems);
                                  if (e.target.checked) next.add(item.productId);
                                  else next.delete(item.productId);
                                  setUnavailableItems(next);
                                }}
                                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                              />
                              <span className={unavailableItems.has(item.productId) ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}>
                                {item.product.name} ({item.quantity} {item.product.unit === "KG" ? "kg" : item.product.unit === "PIECE" ? "pc" : "barq."})
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => handleStockIssue(order.id)}
                            disabled={actionLoading || unavailableItems.size === 0}
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Signaler rupture"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setStockIssueId(null); setUnavailableItems(new Set()); }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── Action buttons ── */
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => { setAcceptingId(order.id); setAcceptMinutes(shopPrepTime); setDenyingId(null); setStockIssueId(null); }}
                        >
                          <CheckCircle size={14} /> Accepter
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 gap-1"
                          onClick={() => { setDenyingId(order.id); setAcceptingId(null); setStockIssueId(null); }}
                        >
                          <XCircle size={14} /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                          onClick={() => { setStockIssueId(order.id); setAcceptingId(null); setDenyingId(null); setUnavailableItems(new Set()); }}
                        >
                          <AlertTriangle size={14} /> Rupture
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── EN COURS ── */}
        {activeTab === "en-cours" && (
          <div className="space-y-3">
            {inProgressOrders.length === 0 ? (
              <EmptyTab icon={<Clock className="w-10 h-10 text-gray-300 dark:text-gray-600" />} message="Aucune commande en cours" />
            ) : (
              inProgressOrders.map((order) => {
                const remaining = order.estimatedReady
                  ? timeRemaining(order.estimatedReady)
                  : null;
                const isOverdue = remaining !== null && remaining < 0;

                return (
                  <Card key={order.id} className="bg-white dark:bg-[#2a2520] border-0 shadow-sm overflow-hidden">
                    <div className={`h-1 ${isOverdue ? "bg-red-500" : "bg-blue-400"}`} />
                    <CardContent className="p-4 space-y-3">
                      {/* Header with timer */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-[#f8f6f3]">
                              {order.orderNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold border ${
                                order.status === "PREPARING"
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300"
                                  : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
                              }`}
                            >
                              {order.status === "PREPARING" ? "En prépa" : "Acceptée"}
                            </Badge>
                            {order.isPro && (
                              <Badge variant="pro" className="text-[10px]">PRO</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {order.user ? `${order.user.firstName} ${order.user.lastName}` : "Client"}
                          </p>
                        </div>
                        {/* Timer */}
                        {remaining !== null && (
                          <div className={`text-right px-3 py-1.5 rounded-lg ${
                            isOverdue ? "bg-red-100 dark:bg-red-950/40" : "bg-blue-50 dark:bg-blue-950/30"
                          }`}>
                            <p className={`text-lg font-bold font-mono ${
                              isOverdue ? "text-red-600" : "text-blue-700 dark:text-blue-300"
                            }`}>
                              {isOverdue ? `+${Math.abs(remaining)}` : remaining} min
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                              {isOverdue ? "en retard" : "restantes"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="bg-gray-50 dark:bg-[#1a1814] rounded-lg p-3 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-sm text-gray-700 dark:text-gray-300">
                            {item.quantity} {item.product.unit === "KG" ? "kg" : item.product.unit === "PIECE" ? "pc" : "barq."} — {item.product.name}
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
                        <span className="font-bold text-gray-900 dark:text-[#f8f6f3]">{formatPrice(order.totalCents)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {order.status === "ACCEPTED" && (
                          <Button
                            size="sm"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-1"
                            onClick={() => handlePreparing(order.id)}
                            disabled={actionLoading}
                          >
                            <ChefHat size={14} /> En préparation
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => handleReady(order.id)}
                          disabled={actionLoading}
                        >
                          <CheckCircle size={14} /> Prête !
                        </Button>
                      </div>

                      {/* +5 / +10 min buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-gray-200 dark:border-[#3a3530] dark:text-gray-300 dark:hover:bg-[#3a3530]"
                          onClick={() => handlePreparing(order.id, 5)}
                          disabled={actionLoading}
                        >
                          <Timer size={13} /> +5 min
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-gray-200 dark:border-[#3a3530] dark:text-gray-300 dark:hover:bg-[#3a3530]"
                          onClick={() => handlePreparing(order.id, 10)}
                          disabled={actionLoading}
                        >
                          <Timer size={13} /> +10 min
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── PRÊTES ── */}
        {activeTab === "pretes" && (
          <div className="space-y-3">
            {/* Scanner button */}
            <Button
              onClick={() => setShowScanner(true)}
              className="w-full bg-[#8b2500] hover:bg-[#6d1d00] gap-2 h-11"
            >
              <ScanLine size={18} /> Scanner un QR code
            </Button>

            {readyOrders.length === 0 ? (
              <EmptyTab icon={<CheckCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />} message="Aucune commande prête" />
            ) : (
              readyOrders.map((order) => {
                const waitTime = order.actualReady
                  ? timeSince(order.actualReady)
                  : null;

                return (
                  <Card key={order.id} className="bg-white dark:bg-[#2a2520] border-0 shadow-sm overflow-hidden">
                    <div className="h-1 bg-emerald-400" />
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-[#f8f6f3]">
                              {order.orderNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                            >
                              Prête
                            </Badge>
                            {order.isPro && (
                              <Badge variant="pro" className="text-[10px]">PRO</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {order.user ? `${order.user.firstName} ${order.user.lastName}` : "Client"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-[#f8f6f3]">{formatPrice(order.totalCents)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {order.items.length} article{order.items.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      {/* Waiting indicator */}
                      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-sm text-amber-800 dark:text-amber-300">
                          En attente du client
                        </span>
                        {waitTime && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">
                            depuis {waitTime}
                          </span>
                        )}
                      </div>

                      {/* QR Code display */}
                      {order.qrCode && (
                        <div className="bg-gray-50 dark:bg-[#1a1814] rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <QrCode size={16} className="text-gray-500 dark:text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Code QR de retrait</span>
                          </div>
                          <p className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300 break-all">
                            {order.qrCode.slice(0, 8)}...{order.qrCode.slice(-4)}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => handlePickedUp(order.id, order.qrCode)}
                          disabled={actionLoading}
                        >
                          <Package size={14} /> Récupérée
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── QR Scanner Dialog ── */}
        <Dialog open={showScanner} onOpenChange={setShowScanner}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scanner QR</DialogTitle>
              <DialogDescription>
                Scannez le QR code du client pour valider le retrait
              </DialogDescription>
            </DialogHeader>
            <div className="p-5 pt-0">
              <QRScanner
                onClose={() => setShowScanner(false)}
                onScanned={() => fetchOrders(true)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
function EmptyTab({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <Card className="bg-white dark:bg-[#2a2520] border-0 shadow-sm">
      <CardContent className="py-12 flex flex-col items-center gap-2">
        {icon}
        <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
      </CardContent>
    </Card>
  );
}
