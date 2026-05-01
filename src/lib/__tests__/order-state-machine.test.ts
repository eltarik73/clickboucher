// @vitest-environment node
//
// State-machine guards for order lifecycle. The Boucher kitchen UI relies on
// canTransition()/getValidTransitions() to expose only legal actions; a bug
// here would either let bouchers move orders into impossible states or
// blacklist legitimate flows. We pin the most important contracts.

import { describe, it, expect } from "vitest";
import {
  canTransition,
  getStepIndex,
  isTerminal,
  isCancellable,
} from "@/lib/order-state-machine";

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
