// src/lib/order-state-machine.ts — Uber Eats style order state machine
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/design-tokens";

// ── Valid transitions ────────────────────────────
// ACCEPTED -> PARTIALLY_DENIED: the butcher reports a missing product after accepting.
// PARTIALLY_DENIED -> PENDING: the customer answered, the butcher decides again.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "DENIED", "CANCELLED", "AUTO_CANCELLED", "PARTIALLY_DENIED"],
  ACCEPTED: ["PREPARING", "READY", "CANCELLED", "DENIED", "PARTIALLY_DENIED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP"],
  PICKED_UP: ["COMPLETED"],
  COMPLETED: [],
  DENIED: [],
  CANCELLED: [],
  PARTIALLY_DENIED: ["PENDING", "ACCEPTED", "CANCELLED", "DENIED"],
  AUTO_CANCELLED: [],
};

// ── Kitchen board ────────────────────────────────
// The two sets partition OrderStatus: an order is either still to be handled
// by the shop (always listed in full) or finished (listed as recent history).
export const KITCHEN_ACTIVE_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PARTIALLY_DENIED",
];

export const KITCHEN_HISTORY_STATUSES: readonly OrderStatus[] = [
  "PICKED_UP",
  "COMPLETED",
  "DENIED",
  "CANCELLED",
  "AUTO_CANCELLED",
];

// ── Discount release ─────────────────────────────
// Entering one of these statuses gives the promo code use or the loyalty
// reward back. All three are terminal, so a release is never undone.
export const DISCOUNT_RELEASING_STATUSES: readonly OrderStatus[] = [
  "DENIED",
  "CANCELLED",
  "AUTO_CANCELLED",
];

// ── Limited stock ────────────────────────────────
// Stock of limited products is reserved while the order is in one of these
// statuses: taken on entering the set, given back on leaving it.
const HOLDS_LIMITED_STOCK: Record<OrderStatus, boolean> = {
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

// ── Step index for progress bar (0-4) ────────────
const STEP_INDEX: Record<OrderStatus, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  PICKED_UP: 4,
  COMPLETED: 4,
  DENIED: -1,
  CANCELLED: -1,
  PARTIALLY_DENIED: 0,
  AUTO_CANCELLED: -1,
};

// Labels and colors now imported from @/lib/design-tokens
// Re-exported via getStatusLabel() and getStatusColor() below

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidTransitions(status: OrderStatus): OrderStatus[] {
  return TRANSITIONS[status] ?? [];
}

export function getStepIndex(status: OrderStatus): number {
  return STEP_INDEX[status] ?? -1;
}

export function getStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function getStatusColor(status: OrderStatus): string {
  return ORDER_STATUS_COLORS[status] ?? "bg-gray-500/10 text-gray-500";
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function holdsLimitedStock(status: OrderStatus): boolean {
  return HOLDS_LIMITED_STOCK[status];
}

export function isCancellable(status: OrderStatus, createdAt: Date): boolean {
  if (status === "PENDING") return true;
  if (status === "ACCEPTED") {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    return createdAt > fiveMinAgo;
  }
  return false;
}

// ── Tracker steps (for UI) ───────────────────────
export const TRACKER_STEPS = [
  { key: "PENDING", label: "Commande reçue", icon: "ClipboardList" },
  { key: "ACCEPTED", label: "Acceptée", icon: "CheckCircle" },
  { key: "PREPARING", label: "En préparation", icon: "ChefHat" },
  { key: "READY", label: "Prête !", icon: "Package" },
  { key: "PICKED_UP", label: "Récupérée", icon: "ShoppingBag" },
] as const;
