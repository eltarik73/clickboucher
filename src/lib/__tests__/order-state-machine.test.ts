// @vitest-environment node
//
// State-machine guards for order lifecycle. The Boucher kitchen UI relies on
// canTransition()/getValidTransitions() to expose only legal actions; a bug
// here would either let bouchers move orders into impossible states or
// blacklist legitimate flows. We pin the most important contracts.

import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  canTransition,
  getStepIndex,
  getValidTransitions,
  holdsLimitedStock,
  isTerminal,
  isCancellable,
  DISCOUNT_RELEASING_STATUSES,
  KITCHEN_ACTIVE_STATUSES,
  KITCHEN_HISTORY_STATUSES,
} from "@/lib/order-state-machine";

const ALL_STATUSES = Object.values(OrderStatus);

describe("canTransition", () => {
  it("should allow PENDING -> ACCEPTED (the happy path entry)", () => {
    expect(canTransition("PENDING", "ACCEPTED")).toBe(true);
  });

  it("should allow ACCEPTED -> PREPARING -> READY -> PICKED_UP -> COMPLETED", () => {
    // Walking the full lifecycle once locks in the standard flow
    expect(canTransition("ACCEPTED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "PICKED_UP")).toBe(true);
    expect(canTransition("PICKED_UP", "COMPLETED")).toBe(true);
  });

  it("should refuse impossible jumps (e.g. PENDING -> READY)", () => {
    // Without this guard a boucher could mark a brand-new order as ready
    expect(canTransition("PENDING", "READY")).toBe(false);
    expect(canTransition("READY", "PENDING")).toBe(false);
  });

  it("should refuse any transition out of a terminal state", () => {
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "ACCEPTED")).toBe(false);
    expect(canTransition("DENIED", "ACCEPTED")).toBe(false);
  });

  it("should allow ACCEPTED -> PARTIALLY_DENIED (out-of-stock declared after acceptance)", () => {
    // The butcher may discover a missing product once the order is accepted
    expect(canTransition("ACCEPTED", "PARTIALLY_DENIED")).toBe(true);
    expect(getValidTransitions("ACCEPTED")).toContain("PARTIALLY_DENIED");
  });

  it("should allow PARTIALLY_DENIED -> PENDING (the customer answered, the butcher decides again)", () => {
    expect(canTransition("PARTIALLY_DENIED", "PENDING")).toBe(true);
    expect(getValidTransitions("PARTIALLY_DENIED")).toContain("PENDING");
  });

  it("should keep out-of-stock handling out of the later stages", () => {
    expect(canTransition("PREPARING", "PARTIALLY_DENIED")).toBe(false);
    expect(canTransition("READY", "PARTIALLY_DENIED")).toBe(false);
    expect(canTransition("ACCEPTED", "PENDING")).toBe(false);
  });

  it("should describe exactly the transition table of the order domain", () => {
    const table = Object.fromEntries(
      ALL_STATUSES.map((status) => [status, [...getValidTransitions(status)].sort()])
    );
    expect(table).toEqual({
      PENDING: ["ACCEPTED", "AUTO_CANCELLED", "CANCELLED", "DENIED", "PARTIALLY_DENIED"],
      ACCEPTED: ["CANCELLED", "DENIED", "PARTIALLY_DENIED", "PREPARING", "READY"],
      PREPARING: ["CANCELLED", "READY"],
      READY: ["PICKED_UP"],
      PICKED_UP: ["COMPLETED"],
      COMPLETED: [],
      DENIED: [],
      CANCELLED: [],
      PARTIALLY_DENIED: ["ACCEPTED", "CANCELLED", "DENIED", "PENDING"],
      AUTO_CANCELLED: [],
    });
  });
});

describe("kitchen board status sets", () => {
  it("should list the statuses the kitchen still has to act on", () => {
    expect([...KITCHEN_ACTIVE_STATUSES].sort()).toEqual([
      "ACCEPTED",
      "PARTIALLY_DENIED",
      "PENDING",
      "PREPARING",
      "READY",
    ]);
  });

  it("should list the finished statuses shown as history", () => {
    expect([...KITCHEN_HISTORY_STATUSES].sort()).toEqual([
      "AUTO_CANCELLED",
      "CANCELLED",
      "COMPLETED",
      "DENIED",
      "PICKED_UP",
    ]);
  });

  it("should partition the OrderStatus enum: every status in exactly one set", () => {
    // An order whose status is in neither set would vanish from the kitchen board
    expect(ALL_STATUSES).toHaveLength(10);
    for (const status of ALL_STATUSES) {
      const memberships =
        Number(KITCHEN_ACTIVE_STATUSES.includes(status)) +
        Number(KITCHEN_HISTORY_STATUSES.includes(status));
      expect(memberships, status).toBe(1);
    }
    expect(KITCHEN_ACTIVE_STATUSES.length + KITCHEN_HISTORY_STATUSES.length).toBe(
      ALL_STATUSES.length
    );
  });
});

describe("DISCOUNT_RELEASING_STATUSES", () => {
  it("should be the three statuses of an order that will never be collected", () => {
    expect([...DISCOUNT_RELEASING_STATUSES].sort()).toEqual([
      "AUTO_CANCELLED",
      "CANCELLED",
      "DENIED",
    ]);
  });

  it("should only contain statuses with no outgoing transition", () => {
    // A released promo code or loyalty reward must never be owed again:
    // the order cannot come back to life
    for (const status of DISCOUNT_RELEASING_STATUSES) {
      expect(getValidTransitions(status), status).toEqual([]);
      expect(isTerminal(status), status).toBe(true);
    }
  });
});

describe("holdsLimitedStock", () => {
  it("should hold stock from acceptance to completion, and in no other status", () => {
    const expected: Record<OrderStatus, boolean> = {
      PENDING: false,
      ACCEPTED: true,
      PREPARING: true,
      READY: true,
      PICKED_UP: true,
      COMPLETED: true,
      DENIED: false,
      CANCELLED: false,
      PARTIALLY_DENIED: false,
      AUTO_CANCELLED: false,
    };
    expect(Object.keys(expected).sort()).toEqual([...ALL_STATUSES].sort());
    for (const status of ALL_STATUSES) {
      expect(holdsLimitedStock(status), status).toBe(expected[status]);
    }
  });
});

describe("getStepIndex", () => {
  it("should return progressive indices for the happy path (used by progress bar)", () => {
    expect(getStepIndex("PENDING")).toBe(0);
    expect(getStepIndex("ACCEPTED")).toBe(1);
    expect(getStepIndex("PREPARING")).toBe(2);
    expect(getStepIndex("READY")).toBe(3);
    expect(getStepIndex("PICKED_UP")).toBe(4);
  });

  it("should return -1 for cancelled/denied terminals (UI hides the step bar)", () => {
    expect(getStepIndex("CANCELLED")).toBe(-1);
    expect(getStepIndex("DENIED")).toBe(-1);
    expect(getStepIndex("AUTO_CANCELLED")).toBe(-1);
  });
});

describe("isTerminal", () => {
  it("should mark COMPLETED, CANCELLED, DENIED, AUTO_CANCELLED as terminal", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("DENIED")).toBe(true);
    expect(isTerminal("AUTO_CANCELLED")).toBe(true);
  });

  it("should not mark in-progress states as terminal", () => {
    expect(isTerminal("PENDING")).toBe(false);
    expect(isTerminal("PREPARING")).toBe(false);
    expect(isTerminal("READY")).toBe(false);
  });
});

describe("isCancellable", () => {
  it("should always allow cancelling a PENDING order", () => {
    expect(isCancellable("PENDING", new Date())).toBe(true);
  });

  it("should allow cancelling an ACCEPTED order only inside the 5-minute grace window", () => {
    // Grace window mirrors Uber Eats: client can cancel within 5min of accept
    const justAccepted = new Date(Date.now() - 60 * 1000); // 1 min ago
    const tooLate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    expect(isCancellable("ACCEPTED", justAccepted)).toBe(true);
    expect(isCancellable("ACCEPTED", tooLate)).toBe(false);
  });

  it("should block cancelling once preparation has started", () => {
    expect(isCancellable("PREPARING", new Date())).toBe(false);
    expect(isCancellable("READY", new Date())).toBe(false);
    expect(isCancellable("PICKED_UP", new Date())).toBe(false);
  });
});
