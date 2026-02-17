// src/lib/order-state-machine.ts — Uber Eats style order state machine
import type { OrderStatus } from "@prisma/client";

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

// ── Labels français ──────────────────────────────
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:          "En attente",
  ACCEPTED:         "Acceptée",
  PREPARING:        "En préparation",
  READY:            "Prête",
  PICKED_UP:        "Récupérée",
  COMPLETED:        "Terminée",
  DENIED:           "Refusée",
  CANCELLED:        "Annulée",
  PARTIALLY_DENIED: "Modification en cours",
  AUTO_CANCELLED:   "Expirée",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACCEPTED:         "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PREPARING:        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  READY:            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PICKED_UP:        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  COMPLETED:        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  DENIED:           "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CANCELLED:        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PARTIALLY_DENIED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  AUTO_CANCELLED:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

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
  return STATUS_LABELS[status] ?? status;
}

export function getStatusColor(status: OrderStatus): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";
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
