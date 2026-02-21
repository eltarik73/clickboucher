// src/hooks/use-order-polling.ts — Polling hook for kitchen/dashboard order updates
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type KitchenOrder = {
  id: string;
  orderNumber: string;
  dailyNumber?: number | null;
  displayNumber?: string | null;
  status: string;
  totalCents: number;
  isPro: boolean;
  customerNote: string | null;
  boucherNote: string | null;
  requestedTime: string | null;
  estimatedReady: string | null;
  actualReady: string | null;
  qrCode: string | null;
  paymentMethod?: string;
  pickupSlotStart: string | null;
  pickupSlotEnd: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    unit: string;
    priceCents: number;
    totalCents: number;
    weightGrams: number | null;
    itemNote: string | null;
    available: boolean;
    product?: { name: string; unit: string; vatRate?: number | null };
  }[];
  user: { firstName: string; lastName: string; customerNumber?: string | null } | null;
  shop?: { id: string; name: string; slug: string; imageUrl: string | null };
};

type UseOrderPollingOptions = {
  /** Polling interval in ms (default 5000 for kitchen, 10000 for dashboard) */
  intervalMs?: number;
  /** Called when a new PENDING order is detected */
  onNewOrder?: (order: KitchenOrder) => void;
  /** Called when any order status changes */
  onStatusChange?: (orderId: string, oldStatus: string, newStatus: string) => void;
  /** Statuses to include (default: active orders) */
  statuses?: string[];
  /** Auto-start polling (default true) */
  enabled?: boolean;
};

export function useOrderPolling(options: UseOrderPollingOptions = {}) {
  const {
    intervalMs = 5000,
    onNewOrder,
    onStatusChange,
    enabled = true,
  } = options;

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track previous state for diff detection
  const prevOrderMapRef = useRef<Map<string, string>>(new Map());
  const callbacksRef = useRef({ onNewOrder, onStatusChange });
  callbacksRef.current = { onNewOrder, onStatusChange };
  const isFirstFetch = useRef(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) {
        setError("Erreur de connexion");
        return;
      }
      const json = await res.json();
      const fetched: KitchenOrder[] = json.data || [];
      setOrders(fetched);
      setError(null);

      // Diff detection (skip on first fetch)
      if (!isFirstFetch.current) {
        const prevMap = prevOrderMapRef.current;

        for (const order of fetched) {
          const prevStatus = prevMap.get(order.id);

          // New order detected
          if (!prevStatus && order.status === "PENDING") {
            callbacksRef.current.onNewOrder?.(order);
          }

          // Status change detected
          if (prevStatus && prevStatus !== order.status) {
            callbacksRef.current.onStatusChange?.(order.id, prevStatus, order.status);
          }
        }
      }
      isFirstFetch.current = false;

      // Update map
      const newMap = new Map<string, string>();
      for (const order of fetched) {
        newMap.set(order.id, order.status);
      }
      prevOrderMapRef.current = newMap;
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchOrders();
    const interval = setInterval(fetchOrders, intervalMs);
    return () => clearInterval(interval);
  }, [fetchOrders, intervalMs, enabled]);

  // Filtered views
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const acceptedOrders = orders.filter((o) => o.status === "ACCEPTED");
  const preparingOrders = orders.filter((o) => o.status === "PREPARING");
  const readyOrders = orders.filter((o) => o.status === "READY");
  const inProgressOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "PREPARING"
  );

  // History: terminal statuses from the last 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const TERMINAL_STATUSES = ["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED", "PARTIALLY_DENIED"];
  const historyOrders = orders
    .filter(
      (o) =>
        TERMINAL_STATUSES.includes(o.status) &&
        new Date(o.updatedAt).getTime() >= threeDaysAgo
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Scheduled: orders with pickupSlotStart in the future
  const scheduledOrders = orders
    .filter(
      (o) =>
        o.pickupSlotStart &&
        new Date(o.pickupSlotStart).getTime() > Date.now() &&
        !TERMINAL_STATUSES.includes(o.status)
    )
    .sort((a, b) => new Date(a.pickupSlotStart!).getTime() - new Date(b.pickupSlotStart!).getTime());

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    // Filtered
    pendingOrders,
    acceptedOrders,
    preparingOrders,
    readyOrders,
    inProgressOrders,
    historyOrders,
    scheduledOrders,
    // Counts
    pendingCount: pendingOrders.length,
    inProgressCount: inProgressOrders.length,
    readyCount: readyOrders.length,
    historyCount: historyOrders.length,
    scheduledCount: scheduledOrders.length,
  };
}
