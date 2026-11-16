// @vitest-environment node
// Ce que le mode cuisine annonce entre deux lectures du tableau : rien à la première lecture, une
// nouvelle commande en attente, un changement de statut (actives et historique), une commande
// programmée qui entre dans les 30 minutes avant son retrait, et la relecture de l'historique
// quand une commande quitte le tableau.
import type { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { diffKitchenBoard, type BoardMemory } from "@/hooks/kitchen-board-diff";
import type { KitchenHistoryOrder, KitchenOrder } from "@/hooks/use-order-polling";

const NOW_MS = Date.parse("2026-11-13T10:00:00.000Z");
const inMinutes = (minutes: number) => new Date(NOW_MS + minutes * 60_000).toISOString();

function active(id: string, status: OrderStatus, pickupSlotStart: string | null = null) {
  return {
    id,
    orderNumber: `KG26-${id}`,
    displayNumber: null,
    status,
    totalCents: 1000,
    discountCents: 0,
    weighToleranceRateBps: null,
    weighToleranceCapCents: null,
    estimatedTotalCents: null,
    customerNumber: null,
    isPro: false,
    customerNote: null,
    requestedTime: null,
    estimatedReady: null,
    actualReady: null,
    qrCode: null,
    paymentMethod: "ON_PICKUP",
    pickupSlotStart,
    createdAt: inMinutes(-10),
    updatedAt: inMinutes(-10),
    items: [],
    user: { firstName: "Fatima", lastName: "Amrani", phone: null, loyaltyBadge: null },
    priceAdjustment: null,
  } satisfies KitchenOrder;
}

function finished(id: string, status: OrderStatus): KitchenHistoryOrder {
  return {
    id,
    orderNumber: `KG26-${id}`,
    displayNumber: null,
    status,
    totalCents: 1000,
    updatedAt: inMinutes(-5),
    items: [],
    user: { firstName: "Fatima", lastName: "Amrani" },
  };
}

function memory(statuses: Record<string, OrderStatus>, scheduledIds: string[] = []): BoardMemory {
  return { statuses: new Map(Object.entries(statuses)), scheduledIds: new Set(scheduledIds) };
}

const ids = (orders: readonly { id: string }[]) => orders.map((order) => order.id);

describe("diffKitchenBoard", () => {
  it("announces nothing on the first read and remembers what it saw", () => {
    const board = {
      active: [active("new", "PENDING"), active("later", "ACCEPTED", inMinutes(45))],
      history: [finished("done", "PICKED_UP")],
    };

    const diff = diffKitchenBoard(null, board, NOW_MS);

    expect(diff).toMatchObject({
      newOrders: [],
      statusChanges: [],
      scheduledReady: [],
      historyWanted: false,
    });
    expect(Object.fromEntries(diff.memory.statuses)).toEqual({
      new: "PENDING",
      later: "ACCEPTED",
      done: "PICKED_UP",
    });
    expect([...diff.memory.scheduledIds]).toEqual(["later"]);
  });

  it("announces an order it has never seen once, and only while it is pending", () => {
    const board = {
      active: [
        active("known", "PENDING"),
        active("fresh", "PENDING"),
        active("auto-accepted", "ACCEPTED"),
      ],
    };

    const diff = diffKitchenBoard(memory({ known: "PENDING" }), board, NOW_MS);

    expect(ids(diff.newOrders)).toEqual(["fresh"]);
  });

  it("reports each status change, on the active orders and in the history", () => {
    const previous = memory({ a: "PENDING", r: "READY", same: "PREPARING" });
    const board = {
      active: [active("a", "ACCEPTED"), active("same", "PREPARING")],
      history: [finished("r", "PICKED_UP")],
    };

    expect(diffKitchenBoard(previous, board, NOW_MS).statusChanges).toEqual([
      { orderId: "a", from: "PENDING", to: "ACCEPTED" },
      { orderId: "r", from: "READY", to: "PICKED_UP" },
    ]);
  });

  it("announces a scheduled order once its pickup slot enters the 30 minute window", () => {
    const previous = memory(
      { soon: "ACCEPTED", far: "ACCEPTED", inside: "PREPARING", asked: "PENDING" },
      ["soon", "far"]
    );
    const board = {
      active: [
        active("soon", "ACCEPTED", inMinutes(30)),
        active("far", "ACCEPTED", inMinutes(31)),
        active("inside", "PREPARING", inMinutes(10)),
        active("asked", "PENDING", inMinutes(90)),
      ],
    };

    const diff = diffKitchenBoard(previous, board, NOW_MS);

    expect(ids(diff.scheduledReady)).toEqual(["soon"]);
    expect([...diff.memory.scheduledIds]).toEqual(["far"]);
  });

  it("wants the history when an order still to handle left the active list", () => {
    const previous = memory({ collected: "READY", denied: "PARTIALLY_DENIED", done: "PICKED_UP" });
    const stillActive = { active: [active("denied", "PARTIALLY_DENIED")] };
    const left = { active: [] };

    expect(diffKitchenBoard(memory({ done: "PICKED_UP" }), left, NOW_MS).historyWanted).toBe(false);
    expect(diffKitchenBoard(previous, stillActive, NOW_MS).historyWanted).toBe(true);
    expect(diffKitchenBoard(previous, { ...left, history: [] }, NOW_MS).historyWanted).toBe(false);

    // A read without history keeps the status it cannot see; a read with history replaces them all.
    const kept = diffKitchenBoard(previous, left, NOW_MS).memory.statuses;
    expect(kept.get("collected")).toBe("READY");
    const read = diffKitchenBoard(
      previous,
      { ...left, history: [finished("collected", "PICKED_UP")] },
      NOW_MS
    );
    expect(Object.fromEntries(read.memory.statuses)).toEqual({ collected: "PICKED_UP" });
  });
});
