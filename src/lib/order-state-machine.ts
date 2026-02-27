// src/lib/order-state-machine.ts — Uber Eats style order state machine
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/design-tokens";

// ── Valid transitions ────────────────────────────
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:          ["ACCEPTED", "DENIED", "CANCELLED", "AUTO_CANCELLED", "PARTIALLY_DENIED"],
  ACCEPTED:         ["PREPARING", "READY", "CANCELLED", "DENIED"],
  PREPARING:        ["READY", "CANCELLED"],
  READY:            ["PICKED_UP"],
  PICKED_UP:        ["COMPLETED"],
  COMPLETED:        [],
  DENIED:           [],
  CANCELLED:        [],
  PARTIALLY_DENIED: ["ACCEPTED", "CANCELLED", "DENIED"],
  AUTO_CANCELLED:   [],
};

// ── Step index for progress bar (0-4) ────────────
const STEP_INDEX: Record<OrderStatus, number> = {
  PENDING:          0,
  ACCEPTED:         1,
  PREPARING:        2,
  READY:            3,
  PICKED_UP:        4,
  COMPLETED:        4,
  DENIED:           -1,
  CANCELLED:        -1,
  PARTIALLY_DENIED: 0,
  AUTO_CANCELLED:   -1,
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
  { key: "PENDING",   label: "Commande reçue",   icon: "ClipboardList" },
  { key: "ACCEPTED",  label: "Acceptée",          icon: "CheckCircle" },
  { key: "PREPARING", label: "En préparation",    icon: "ChefHat" },
  { key: "READY",     label: "Prête !",           icon: "Package" },
  { key: "PICKED_UP", label: "Récupérée",         icon: "ShoppingBag" },
] as const;
