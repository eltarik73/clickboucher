// src/hooks/use-order-polling.ts — Polling hook of the kitchen board (mode cuisine)
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { KITCHEN_HISTORY_STATUSES } from "@/lib/order-state-machine";

/** An order of the kitchen board, as GET /api/boucher/orders/kitchen returns it (columns selected by
 * kitchenOrderSelect in src/lib/services/orders/kitchen.ts). */
export type KitchenOrder = {
  id: string;
  orderNumber: string;
  displayNumber?: string | null;
  status: string;
  totalCents: number;
  /** Discount on goods recorded at creation (Order.discountCents). */
  discountCents: number;
  /** Customer number in this shop, frozen on the order; format with formatCustomerNumber. */
  customerNumber: number | null;
  isPro: boolean;
  customerNote: string | null;
  requestedTime: string | null;
  estimatedReady: string | null;
  actualReady: string | null;
  qrCode: string | null;
  paymentMethod?: string;
  pickupSlotStart: string | null;
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
    available: boolean;
    product?: { name: string; unit: string; imageUrl?: string | null };
  }[];
  user: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    loyaltyBadge?: string | null;
  } | null;
  priceAdjustment?: {
    id: string;
    originalTotal: number;
    newTotal: number;
    reason: string | null;
    adjustmentType: string;
    status: string;
  } | null;
};

/** A finished order as the history list prints it (kitchenHistorySelect). */
export type KitchenHistoryOrder = Pick<
  KitchenOrder,
  "id" | "orderNumber" | "displayNumber" | "status" | "totalCents" | "updatedAt"
> & {
  items: { quantity: number }[];
  user: { firstName: string; lastName: string } | null;
};

type UseOrderPollingOptions = {
  /** Polling interval in ms (default 5000) */
  intervalMs?: number;
  /** Called when a new PENDING order is detected */
  onNewOrder?: (order: KitchenOrder) => void;
  /** Called when any order status changes */
  onStatusChange?: (orderId: string, oldStatus: string, newStatus: string) => void;
  /** Called when a scheduled order enters the 30-min preparation window */
  onScheduledReady?: (order: KitchenOrder) => void;
  /** Auto-start polling (default true) */
  enabled?: boolean;
};

// PARTIALLY_DENIED is shown in history until the board has a "waiting for customer" column.
const FINISHED_STATUSES: readonly string[] = KITCHEN_HISTORY_STATUSES;
const TERMINAL_STATUSES: readonly string[] = [...FINISHED_STATUSES, "PARTIALLY_DENIED"];
const THIRTY_MIN = 30 * 60 * 1000;

type PollOutcome = "ok" | "auth" | "error";

/** `history` is present only when the poll asked for it (?history=1). */
type KitchenBoardPayload = {
  active: KitchenOrder[];
  activeTruncated: boolean;
  history?: KitchenHistoryOrder[];
};

function isKitchenBoardPayload(data: unknown): data is KitchenBoardPayload {
  if (typeof data !== "object" || data === null) return false;
  const board = data as Record<string, unknown>;
  return (
    Array.isArray(board.active) &&
    typeof board.activeTruncated === "boolean" &&
    (board.history === undefined || Array.isArray(board.history))
  );
}

const KITCHEN_URL = "/api/boucher/orders/kitchen";
/** The finished orders are re-read at most once a minute, unless the board needs them sooner. */
export const HISTORY_REFRESH_MS = 60_000;

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
  const [history, setHistory] = useState<KitchenHistoryOrder[]>([]);
  // More active orders than the server returns: the board must say so instead of hiding them
  const [activeTruncated, setActiveTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True after 3 consecutive 401/403 — cleared by the next successful poll
  const [authExpired, setAuthExpired] = useState(false);
  // Timestamp (ms) of the last successful poll — null until the first one
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  // Last known status of every order seen, active or finished, for diff detection. An order that
  // leaves the board keeps its entry until the next history read tells its new status.
  const prevOrderMapRef = useRef<Map<string, string>>(new Map());
  const prevScheduledIdsRef = useRef<Set<string>>(new Set());
  const callbacksRef = useRef({ onNewOrder, onStatusChange, onScheduledReady });
  callbacksRef.current = { onNewOrder, onStatusChange, onScheduledReady };
  const isFirstFetch = useRef(true);
  // History: read with the first poll, then at most once a minute or when the board needs it
  const lastHistoryAtRef = useRef<number | null>(null);
  const historyWantedRef = useRef(false);

  // Lets a successful manual refetch() bring the loop back to its normal cadence
  const resumeLoopRef = useRef<(() => void) | null>(null);

  const pollOnce = useCallback(async (controller: AbortController): Promise<PollOutcome> => {
    const abortTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const lastHistoryAt = lastHistoryAtRef.current;
    const withHistory =
      historyWantedRef.current ||
      lastHistoryAt === null ||
      Date.now() - lastHistoryAt >= HISTORY_REFRESH_MS;
    try {
      const res = await fetch(withHistory ? `${KITCHEN_URL}?history=1` : KITCHEN_URL, {
        signal: controller.signal,
      });
      if (!res.ok) {
        setError("Erreur de connexion");
        return res.status === 401 || res.status === 403 ? "auth" : "error";
      }
      const json: unknown = await res.json();
      const board =
        typeof json === "object" && json !== null ? (json as { data?: unknown }).data : undefined;
      if (!isKitchenBoardPayload(board)) {
        setError("Erreur de connexion");
        return "error";
      }
      const active = board.active;
      const finished = board.history;
      setOrders(active);
      if (finished) {
        setHistory(finished);
        lastHistoryAtRef.current = Date.now();
        historyWantedRef.current = false;
      }
      setActiveTruncated(board.activeTruncated);
      setError(null);
      setAuthExpired(false);
      setLastSuccessAt(Date.now());

      const prevMap = prevOrderMapRef.current;
      const seen: { id: string; status: string }[] = [...active, ...(finished ?? [])];

      // Diff detection (skip on first fetch)
      if (!isFirstFetch.current) {
        const prevScheduledIds = prevScheduledIdsRef.current;

        for (const order of seen) {
          const prevStatus = prevMap.get(order.id);
          if (prevStatus && prevStatus !== order.status) {
            notify(() => callbacksRef.current.onStatusChange?.(order.id, prevStatus, order.status));
          }
        }

        for (const order of active) {
          // New order detected
          if (!prevMap.has(order.id) && order.status === "PENDING") {
            notify(() => callbacksRef.current.onNewOrder?.(order));
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

      // An order that was on the board and is no longer there has just finished: read the history
      // on the next poll, which reports its new status.
      const activeIds = new Set(active.map((order) => order.id));
      const leftTheBoard = [...prevMap].some(
        ([id, status]) => !activeIds.has(id) && !FINISHED_STATUSES.includes(status)
      );
      if (!finished && leftTheBoard) historyWantedRef.current = true;

      // Update maps: a poll without history keeps the entries it cannot see
      const newMap = new Map<string, string>(finished ? [] : prevMap);
      for (const order of seen) newMap.set(order.id, order.status);
      const newScheduledIds = new Set<string>();
      for (const order of active) {
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

  /** Re-read the finished orders now (history tab or drawer opened). */
  const refreshHistory = useCallback(() => {
    historyWantedRef.current = true;
    void fetchOrders();
  }, [fetchOrders]);

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

  // History: the server already bounds finished orders to the last 7 days
  const historyOrders: KitchenHistoryOrder[] = [
    ...history,
    ...orders.filter((o) => TERMINAL_STATUSES.includes(o.status)),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    /** Active orders of the board (finished ones are in historyOrders). */
    orders,
    loading,
    error,
    refetch: fetchOrders,
    refreshHistory,
    activeTruncated,
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
