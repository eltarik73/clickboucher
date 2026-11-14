// src/hooks/useOrderTracker.ts — Suivi en direct d'une commande, pour sa page de suivi (/suivi/[id]).
// Lit GET /api/orders/[id]/status (vue client de la commande) toutes les 5 s tant que l'onglet est
// visible ; accès par la session du client ou par le cookie de la commande d'un invité.
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OrderStatus } from "@prisma/client";
import { nextOrderPollDelay, startVisiblePolling } from "@/hooks/useVisiblePolling";
import { KITCHEN_HISTORY_STATUSES } from "@/lib/order-state-machine";
import type { SaleUnit } from "@/lib/pricing/line";

export interface TrackedOrderItem {
  id: string;
  name: string;
  /** Stored OrderItem.quantity: kilograms for KG and TRANCHE, a count otherwise. */
  quantity: number;
  unit: SaleUnit;
  totalCents: number;
  weightGrams: number | null;
}

export interface TrackedPriceAdjustment {
  id: string;
  originalTotal: number;
  newTotal: number;
  reason: string | null;
  adjustmentType: string;
  status: string;
  tier: number;
  autoApproveAt: string | null;
  escalateAt: string | null;
  createdAt: string;
}

/**
 * What the tracking page reads of an order, in the JSON of the customer view
 * (src/lib/services/orders/customer-view.ts, dates as ISO strings).
 */
export interface TrackedOrder {
  id: string;
  status: OrderStatus;
  displayNumber: string | null;
  totalCents: number;
  boucherNote: string | null;
  estimatedReady: string | null;
  actualReady: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: TrackedOrderItem[];
  priceAdjustment: TrackedPriceAdjustment | null;
}

/** The order carried by an API answer `{ success: true, data }`, or null for any other body. */
export function trackedOrderFrom(body: unknown): TrackedOrder | null {
  if (typeof body !== "object" || body === null) return null;
  const { success, data } = body as { success?: unknown; data?: unknown };
  if (success !== true || typeof data !== "object" || data === null) return null;
  return typeof (data as { status?: unknown }).status === "string" ? (data as TrackedOrder) : null;
}

/** An order the shop no longer handles: nothing changes on its tracking page any more. */
function isFinished(status: OrderStatus): boolean {
  return KITCHEN_HISTORY_STATUSES.includes(status);
}

interface OrderRead {
  /** HTTP status of the answer; 0 for a network error or a body that is not JSON. */
  httpStatus: number;
  order: TrackedOrder | null;
}

async function readTrackedOrder(orderId: string): Promise<OrderRead> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      cache: "no-store",
    });
    return { httpStatus: res.status, order: res.ok ? trackedOrderFrom(await res.json()) : null };
  } catch {
    return { httpStatus: 0, order: null };
  }
}

interface UseOrderTrackerOptions {
  orderId: string;
  /** Status on screen: a finished order is not polled, and polling stops once it is finished. */
  status: OrderStatus;
  /** Receives every successful read. A failure calls nothing: the page keeps what it shows. */
  onUpdate: (order: TrackedOrder) => void;
}

/**
 * Polls the order while it is not finished: 5 s while the tab is visible, nothing while it is
 * hidden, an immediate read when the tab comes back, on focus and when the network returns,
 * backoff up to 60 s on errors, and a definitive stop on 404 or on a finished order.
 * The first read comes one interval after mount: the server has just rendered the order.
 * `refresh` reads at once (after an action of the customer).
 */
export function useOrderTracker({ orderId, status, onUpdate }: UseOrderTrackerOptions): {
  refresh: () => Promise<void>;
} {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const finished = isFinished(status);

  useEffect(() => {
    if (finished) return;
    // startVisiblePolling makes its first call synchronously, while `starting` is still true:
    // that call reads nothing and only schedules the first read, one interval later.
    let starting = true;
    let httpStatus = 200;
    let failures = 0;
    const stop = startVisiblePolling(
      async () => {
        if (!starting) {
          const read = await readTrackedOrder(orderId);
          httpStatus = read.httpStatus;
          if (read.order === null) {
            failures += 1;
          } else {
            failures = 0;
            onUpdateRef.current(read.order);
            if (isFinished(read.order.status)) return null;
          }
        }
        return nextOrderPollDelay({ httpStatus, everLoaded: true, failures });
      },
      {
        onWake: () => {
          failures = 0;
        },
        wakeOn: ["focus", "online"],
      }
    );
    starting = false;
    return stop;
  }, [orderId, finished]);

  const refresh = useCallback(async () => {
    const read = await readTrackedOrder(orderId);
    if (read.order !== null) onUpdateRef.current(read.order);
  }, [orderId]);

  return { refresh };
}
