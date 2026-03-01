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
    sliceCount: number | null;
    sliceThickness: string | null;
    itemNote: string | null;
    available: boolean;
    product?: { name: string; unit: string; vatRate?: number | null; imageUrl?: string | null };
  }[];
  user: { firstName: string; lastName: string; customerNumber?: string | null; phone?: string | null } | null;
  shop?: { id: string; name: string; slug: string; imageUrl: string | null; priceAdjustmentThreshold?: number };
  priceAdjustment?: {
    id: string;
    originalTotal: number;
    newTotal: number;
    reason: string | null;
    adjustmentType: string;
    status: string;
    itemsSnapshot: unknown;
    autoApproveAt: string | null;
    respondedAt: string | null;
    createdAt: string;
  } | null;
};

type UseOrderPollingOptions = {
  /** Polling interval in ms (default 5000 for kitchen, 10000 for dashboard) */
  intervalMs?: number;
  /** Called when a new PENDING order is detected */
  onNewOrder?: (order: KitchenOrder) => void;
  /** Called when any order status changes */
  onStatusChange?: (orderId: string, oldStatus: string, newStatus: string) => void;
  /** Called when a scheduled order enters the 30-min preparation window */
  onScheduledReady?: (order: KitchenOrder) => void;
  /** Statuses to include (default: active orders) */
  statuses?: string[];
  /** Auto-start polling (default true) */
  enabled?: boolean;
};

const TERMINAL_STATUSES = ["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED", "PARTIALLY_DENIED"];
const THIRTY_MIN = 30 * 60 * 1000;

export function useOrderPolling(options: UseOrderPollingOptions = {}) {
  const {
    intervalMs = 5000,
    onNewOrder,
    onStatusChange,
    onScheduledReady,
    enabled = true,
  } = options;

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track previous state for diff detection
  const prevOrderMapRef = useRef<Map<string, string>>(new Map());
  const prevScheduledIdsRef = useRef<Set<string>>(new Set());
  const callbacksRef = useRef({ onNewOrder, onStatusChange, onScheduledReady });
  callbacksRef.current = { onNewOrder, onStatusChange, onScheduledReady };
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
        const prevScheduledIds = prevScheduledIdsRef.current;

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

          // Scheduled order entered 30-min preparation window
          if (
            prevScheduledIds.has(order.id) &&
            order.pickupSlotStart &&
            new Date(order.pickupSlotStart).getTime() <= Date.now() + THIRTY_MIN &&
            !TERMINAL_STATUSES.includes(order.status) &&
            order.status !== "PENDING"
          ) {
            callbacksRef.current.onScheduledReady?.(order);
          }
        }
      }
      isFirstFetch.current = false;

      // Update maps
      const newMap = new Map<string, string>();
      const newScheduledIds = new Set<string>();
      for (const order of fetched) {
        newMap.set(order.id, order.status);
        // Track orders that are still in the "scheduled future" window (>30min)
        if (
          order.pickupSlotStart &&
          new Date(order.pickupSlotStart).getTime() > Date.now() + THIRTY_MIN &&
          !TERMINAL_STATUSES.includes(order.status) &&
          order.status !== "PENDING"
        ) {
          newScheduledIds.add(order.id);
        }
      }
      prevOrderMapRef.current = newMap;
      prevScheduledIdsRef.current = newScheduledIds;
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
  const inProgressOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "PREPARING"
  );
  const readyOrders = orders.filter((o) => o.status === "READY");

  // History: terminal statuses from the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const historyOrders = orders
    .filter(
      (o) =>
        TERMINAL_STATUSES.includes(o.status) &&
        new Date(o.updatedAt).getTime() >= sevenDaysAgo
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    // Filtered
    pendingOrders,
    inProgressOrders,
    readyOrders,
    historyOrders,
    // Counts
    pendingCount: pendingOrders.length,
    inProgressCount: inProgressOrders.length,
    readyCount: readyOrders.length,
    historyCount: historyOrders.length,
  };
}
