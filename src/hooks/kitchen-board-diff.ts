// What changed on the kitchen board between two reads: the events the kitchen page announces
// (sound, alert, notification). Pure: the polling hook reads the board and fires the events.
import type { OrderStatus } from "@prisma/client";
import type { Serialized } from "@/lib/api/json";
import {
  KITCHEN_AWAITING_CUSTOMER_STATUSES,
  KITCHEN_HISTORY_STATUSES,
} from "@/lib/order-state-machine";
import type { KitchenHistoryRow, KitchenRow } from "@/lib/services/orders/kitchen";

// The rows as the client reads them, which the polling hook exports as KitchenOrder and
// KitchenHistoryOrder (named here from the service, so that the hook and this module do not
// import each other).
type ActiveOrder = Serialized<KitchenRow>;
type FinishedOrder = Serialized<KitchenHistoryRow>;

/** A scheduled order is prepared, and announced, once its pickup slot starts within this window. */
export const PREPARATION_WINDOW_MS = 30 * 60 * 1000;

/** What the board remembers of the previous read. */
export interface BoardMemory {
  /** Last known status of every order seen, active or finished. */
  statuses: ReadonlyMap<string, OrderStatus>;
  /** Accepted orders whose pickup slot was still beyond the preparation window. */
  scheduledIds: ReadonlySet<string>;
}

/** The board files these orders under history: finished, or waiting for the customer's answer. */
export function isFiledInHistory(status: OrderStatus): boolean {
  return (
    KITCHEN_HISTORY_STATUSES.includes(status) || KITCHEN_AWAITING_CUSTOMER_STATUSES.includes(status)
  );
}

/** Start of the pickup slot an accepted order of the working columns waits for; null otherwise. */
function awaitedSlotMs(order: ActiveOrder): number | null {
  if (order.pickupSlotStart === null) return null;
  if (order.status === "PENDING" || isFiledInHistory(order.status)) return null;
  return new Date(order.pickupSlotStart).getTime();
}

/**
 * The events between the previous read (null before the first one, which announces nothing) and
 * this one. A read without history keeps the statuses it cannot see: an order that left the
 * active list is reported once the next read with history tells its new status.
 */
export function diffKitchenBoard(
  previous: BoardMemory | null,
  board: { active: readonly ActiveOrder[]; history?: readonly FinishedOrder[] },
  nowMs: number
): {
  newOrders: ActiveOrder[];
  statusChanges: { orderId: string; from: OrderStatus; to: OrderStatus }[];
  scheduledReady: ActiveOrder[];
  historyWanted: boolean;
  memory: BoardMemory;
} {
  const seen = [...board.active, ...(board.history ?? [])];
  const windowEndMs = nowMs + PREPARATION_WINDOW_MS;

  const kept = board.history === undefined && previous !== null ? previous.statuses : [];
  const statuses = new Map<string, OrderStatus>(kept);
  for (const order of seen) statuses.set(order.id, order.status);
  const scheduledIds = new Set<string>();
  for (const order of board.active) {
    const slotMs = awaitedSlotMs(order);
    if (slotMs !== null && slotMs > windowEndMs) scheduledIds.add(order.id);
  }
  const memory = { statuses, scheduledIds };

  if (previous === null) {
    return { newOrders: [], statusChanges: [], scheduledReady: [], historyWanted: false, memory };
  }

  const activeIds = new Set(board.active.map((order) => order.id));
  return {
    newOrders: board.active.filter(
      (order) => order.status === "PENDING" && !previous.statuses.has(order.id)
    ),
    statusChanges: seen.flatMap((order) => {
      const from = previous.statuses.get(order.id);
      return from === undefined || from === order.status
        ? []
        : [{ orderId: order.id, from, to: order.status }];
    }),
    scheduledReady: board.active.filter((order) => {
      const slotMs = awaitedSlotMs(order);
      return previous.scheduledIds.has(order.id) && slotMs !== null && slotMs <= windowEndMs;
    }),
    // An order still to handle left the active list: only the history tells what became of it.
    historyWanted:
      board.history === undefined &&
      [...previous.statuses].some(
        ([id, status]) => !activeIds.has(id) && !KITCHEN_HISTORY_STATUSES.includes(status)
      ),
    memory,
  };
}
