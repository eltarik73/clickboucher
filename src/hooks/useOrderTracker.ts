// src/hooks/useOrderTracker.ts — Polling hook for order tracking (Uber Eats style)
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type OrderStatus = {
  id: string;
  status: string;
  orderNumber: string;
  estimatedReady: string | null;
  actualReady: string | null;
  pickedUpAt: string | null;
  qrCode: string | null;
  totalCents: number;
  denyReason: string | null;
  boucherNote: string | null;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    totalCents: number;
    available: boolean;
    replacement: string | null;
    weightGrams: number | null;
  }[];
  shop: {
    id: string;
    name: string;
    phone: string;
    address: string;
  };
};

type UseOrderTrackerOptions = {
  orderId: string;
  enabled?: boolean;
  intervalMs?: number;
  onStatusChange?: (newStatus: string, oldStatus: string) => void;
};

export function useOrderTracker({
  orderId,
  enabled = true,
  intervalMs = 5000,
  onStatusChange,
}: UseOrderTrackerOptions) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      const json = await res.json();

      if (!json.success) {
        setError(json.error?.message || "Erreur");
        return;
      }

      const data = json.data as OrderStatus;
      setOrder(data);
      setError(null);

      // Detect status change
      if (prevStatusRef.current && prevStatusRef.current !== data.status) {
        onStatusChangeRef.current?.(data.status, prevStatusRef.current);
      }
      prevStatusRef.current = data.status;
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !orderId) return;

    // Initial fetch
    fetchStatus();

    // Poll with visibility API check
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchStatus();
      }
    }, intervalMs);

    // Refetch on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, orderId, intervalMs, fetchStatus]);

  // Terminal states — stop polling
  const isTerminal = order
    ? ["COMPLETED", "CANCELLED", "DENIED", "AUTO_CANCELLED"].includes(order.status)
    : false;

  return {
    order,
    loading,
    error,
    isTerminal,
    refetch: fetchStatus,
  };
}
