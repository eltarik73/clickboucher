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
    variant: string | null;
    pieceCount: number | null;
    pieceLabel: string | null;
    cutOption: string | null;
    cutPriceCents: number | null;
    itemNote: string | null;
    available: boolean;
    product?: { name: string; unit: string; vatRate?: number | null; imageUrl?: string | null };
  }[];
  user: { firstName: string; lastName: string; customerNumber?: string | null; phone?: string | null; loyaltyBadge?: string | null } | null;
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

type PollOutcome = "ok" | "auth" | "error";

/** A stalled request is aborted so it can never freeze the single-flight loop */
const FETCH_TIMEOUT_MS = 10_000;
/** Minimum cadence while the tab is hidden */
const HIDDEN_INTERVAL_MS = 15_000;
/** 401/403: 10 s, 20 s, 40 s … capped at 5 min */
const AUTH_BACKOFF_BASE_MS = 10_000;
const AUTH_BACKOFF_MAX_MS = 5 * 60 * 1000;
/** Network / 5xx errors: intervalMs, ×2, ×4 … capped at 60 s */
const ERROR_BACKOFF_MAX_MS = 60_000;
/** Consecutive 401/403 before the session is reported as expired */
const AUTH_EXPIRED_AFTER = 3;
/** visibilitychange + focus usually fire together: one immediate poll is enough */
const WAKE_DEDUPE_MS = 1_000;

// Une exception levée par un callback du consommateur (toast, notification…)
// ne doit pas être comptée comme un échec du poll : sinon backoff injustifié et
// commande ré-annoncée à chaque passage.
function notify(callback: () => void): void {
  try {
    callback();
  } catch {
    // le fetch a réussi ; l'erreur vient de l'UI appelante
  }
}

/**
 * Delay before the next poll, counted from the start of the previous one.
 * - ok: `intervalMs` when the tab is visible, at least 15 s when it is hidden
 * - auth (401/403): exponential backoff from 10 s to 5 min
 * - error: exponential backoff from `intervalMs` to 60 s
 * `authStreak` / `errorStreak` are the consecutive failure counts, the current one included.
 */
export function nextPollDelay(input: {
  outcome: PollOutcome;
  intervalMs: number;
  visible: boolean;
  elapsedMs: number;
  authStreak: number;
  errorStreak: number;
}): number {
  const { outcome, intervalMs, visible, elapsedMs, authStreak, errorStreak } = input;
  const base = visible ? intervalMs : Math.max(intervalMs, HIDDEN_INTERVAL_MS);
  let target = base;
  if (outcome === "auth") {
    const backoff = AUTH_BACKOFF_BASE_MS * 2 ** Math.max(0, authStreak - 1);
    target = Math.max(base, Math.min(backoff, AUTH_BACKOFF_MAX_MS));
  } else if (outcome === "error") {
    const backoff = intervalMs * 2 ** Math.max(0, errorStreak - 1);
    target = Math.max(base, Math.min(backoff, ERROR_BACKOFF_MAX_MS));
  }
  return Math.max(0, target - elapsedMs);
}

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
  // True after 3 consecutive 401/403 — cleared by the next successful poll
  const [authExpired, setAuthExpired] = useState(false);
  // Timestamp (ms) of the last successful poll — null until the first one
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  // Track previous state for diff detection
  const prevOrderMapRef = useRef<Map<string, string>>(new Map());
  const prevScheduledIdsRef = useRef<Set<string>>(new Set());
  const callbacksRef = useRef({ onNewOrder, onStatusChange, onScheduledReady });
  callbacksRef.current = { onNewOrder, onStatusChange, onScheduledReady };
  const isFirstFetch = useRef(true);

  // Lets a successful manual refetch() bring the loop back to its normal cadence
  const resumeLoopRef = useRef<(() => void) | null>(null);

  const pollOnce = useCallback(async (controller: AbortController): Promise<PollOutcome> => {
    const abortTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/orders", { signal: controller.signal });
      if (!res.ok) {
        setError("Erreur de connexion");
        return res.status === 401 || res.status === 403 ? "auth" : "error";
      }
      const json = await res.json();
      const fetched: KitchenOrder[] = json.data || [];
      setOrders(fetched);
      setError(null);
      setAuthExpired(false);
      setLastSuccessAt(Date.now());

      // Diff detection (skip on first fetch)
      if (!isFirstFetch.current) {
        const prevMap = prevOrderMapRef.current;
        const prevScheduledIds = prevScheduledIdsRef.current;

        for (const order of fetched) {
          const prevStatus = prevMap.get(order.id);

          // New order detected
          if (!prevStatus && order.status === "PENDING") {
            notify(() => callbacksRef.current.onNewOrder?.(order));
          }

          // Status change detected
          if (prevStatus && prevStatus !== order.status) {
            notify(() => callbacksRef.current.onStatusChange?.(order.id, prevStatus, order.status));
          }

          // Scheduled order entered 30-min preparation window
          if (
            prevScheduledIds.has(order.id) &&
            order.pickupSlotStart &&
            new Date(order.pickupSlotStart).getTime() <= Date.now() + THIRTY_MIN &&
            !TERMINAL_STATUSES.includes(order.status) &&
            order.status !== "PENDING"
          ) {
            notify(() => callbacksRef.current.onScheduledReady?.(order));
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
      return "ok";
    } catch {
      setError("Erreur de connexion");
      return "error";
    } finally {
      clearTimeout(abortTimer);
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const outcome = await pollOnce(new AbortController());
    if (outcome === "ok") resumeLoopRef.current?.();
  }, [pollOnce]);

  // Self-rescheduling, single-flight polling loop (replaces setInterval):
  // never overlaps requests, slows down in a hidden tab and backs off on errors.
  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;
    let supersededByWake = false;
    let startedAt = 0;
    let authStreak = 0;
    let errorStreak = 0;

    function schedule(delayMs: number) {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delayMs);
    }

    async function tick() {
      if (stopped || inFlight) return;
      inFlight = true;
      startedAt = Date.now();
      const controller = new AbortController();
      activeController = controller;
      let outcome: PollOutcome;
      try {
        outcome = await pollOnce(controller);
      } catch {
        outcome = "error";
      }
      inFlight = false;
      activeController = null;
      if (stopped) return;

      // Aborted by wake(): the tab is back, poll again right away
      if (supersededByWake) {
        supersededByWake = false;
        void tick();
        return;
      }

      if (outcome === "ok") {
        authStreak = 0;
        errorStreak = 0;
      } else if (outcome === "auth") {
        authStreak += 1;
        if (authStreak >= AUTH_EXPIRED_AFTER) setAuthExpired(true);
      } else {
        errorStreak += 1;
      }

      schedule(
        nextPollDelay({
          outcome,
          intervalMs,
          visible: document.visibilityState === "visible",
          elapsedMs: Date.now() - startedAt,
          authStreak,
          errorStreak,
        })
      );
    }

    // Tab visible again / window focused / network back: drop the backoff and poll now
    function wake() {
      if (stopped || document.visibilityState !== "visible") return;
      const healthy = authStreak === 0 && errorStreak === 0;
      if (healthy && Date.now() - startedAt < WAKE_DEDUPE_MS) return;
      authStreak = 0;
      errorStreak = 0;
      if (inFlight) {
        // Pending for longer than one interval: most likely stuck on a dead socket
        // (device sleep, Wi-Fi roaming) — drop it instead of waiting for the timeout.
        if (Date.now() - startedAt > intervalMs) {
          supersededByWake = true;
          activeController?.abort();
        }
        return;
      }
      if (timer) clearTimeout(timer);
      void tick();
    }

    resumeLoopRef.current = () => {
      if (authStreak === 0 && errorStreak === 0) return;
      authStreak = 0;
      errorStreak = 0;
      if (!inFlight) schedule(intervalMs);
    };

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      resumeLoopRef.current = null;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [pollOnce, intervalMs, enabled]);

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
    // Connection health
    authExpired,
    lastSuccessAt,
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
