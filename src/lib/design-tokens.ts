// src/lib/design-tokens.ts — Single source of truth for status colors & design tokens
// Import from here instead of defining local STATUS_COLORS in each file

// ── Order Status Colors (badge classes) ──────────────
export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING:          "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ACCEPTED:         "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PREPARING:        "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  READY:            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PICKED_UP:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  COMPLETED:        "bg-green-500/10 text-green-600 dark:text-green-400",
  DENIED:           "bg-red-500/10 text-red-500",
  CANCELLED:        "bg-gray-500/10 text-gray-500",
  PARTIALLY_DENIED: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  AUTO_CANCELLED:   "bg-gray-400/10 text-gray-400",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING:          "En attente",
  ACCEPTED:         "Acceptée",
  PREPARING:        "En préparation",
  READY:            "Prête",
  PICKED_UP:        "Récupérée",
  COMPLETED:        "Terminée",
  DENIED:           "Refusée",
  CANCELLED:        "Annulée",
  PARTIALLY_DENIED: "Partiel. refusée",
  AUTO_CANCELLED:   "Expirée",
};

// ── Order Status Hex Colors (for Recharts / SVG) ────
export const ORDER_STATUS_HEX: Record<string, string> = {
  PENDING:          "#eab308",
  ACCEPTED:         "#3b82f6",
  PREPARING:        "#6366f1",
  READY:            "#10b981",
  PICKED_UP:        "#22c55e",
  COMPLETED:        "#16a34a",
  DENIED:           "#ef4444",
  CANCELLED:        "#9ca3af",
  PARTIALLY_DENIED: "#f97316",
  AUTO_CANCELLED:   "#9ca3af",
};

// ── Kitchen Order Card border colors ────────────────
export const ORDER_STATUS_BORDER: Record<string, string> = {
  PENDING:   "border-t-amber-400",
  ACCEPTED:  "border-t-blue-400",
  PREPARING: "border-t-indigo-400",
  READY:     "border-t-emerald-400",
};

// ── Shop Status Colors ──────────────────────────────
export const SHOP_STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  BUSY:        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PAUSED:      "bg-red-500/10 text-red-500",
  AUTO_PAUSED: "bg-red-500/10 text-red-500",
  CLOSED:      "bg-gray-500/10 text-gray-500",
  VACATION:    "bg-blue-500/10 text-blue-500",
};

export const SHOP_STATUS_LABELS: Record<string, string> = {
  OPEN:        "Ouvert",
  BUSY:        "Occupé",
  PAUSED:      "En pause",
  AUTO_PAUSED: "Auto-pause",
  CLOSED:      "Fermé",
  VACATION:    "Vacances",
};

// ── Subscription Status ─────────────────────────────
export const SUB_STATUS_COLORS: Record<string, string> = {
  TRIAL:     "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  ACTIVE:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  SUSPENDED: "bg-red-500/10 text-red-500",
  CANCELLED: "bg-gray-500/10 text-gray-500",
  EXPIRED:   "bg-gray-500/10 text-gray-400",
  PENDING:   "bg-amber-500/10 text-amber-600",
};

// ── Plan Colors ─────────────────────────────────────
export const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  PRO:     "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  PREMIUM: "bg-primary/10 text-primary",
};
