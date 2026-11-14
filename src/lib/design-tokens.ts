// src/lib/design-tokens.ts — Source unique des échelles du thème, du contrat de contraste et des statuts.
// Données pures (aucun import d'exécution) : lu par le chargeur de tailwind.config.ts et par le navigateur.
// Les VALEURS de couleur vivent dans src/styles/globals.css ; ce fichier dit quelles paires doivent être lisibles.
import type { OrderStatus, ShopStatus } from "@prisma/client";

// ── Échelles du thème Tailwind (lues aussi par cn() dans src/lib/utils.ts) ──
export type FontSizeToken = "hero" | "title" | "subtitle" | "body-lg" | "body" | "caption" | "micro";

export const FONT_SIZE_SCALE: Record<
  FontSizeToken,
  [string, { lineHeight: string; fontWeight: string; letterSpacing?: string }]
> = {
  hero: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
  title: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
  subtitle: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
  "body-lg": ["1.0625rem", { lineHeight: "1.5", fontWeight: "400" }],
  body: ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }],
  caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "500" }],
  micro: ["0.6875rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.02em" }],
};

export type ShadowToken = "soft" | "card" | "elevated" | "glow";

export const SHADOW_SCALE: Record<ShadowToken, string> = {
  soft: "0 2px 8px -2px rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.08)",
  card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
  elevated: "0 8px 32px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)",
  glow: "0 0 24px -4px hsl(var(--primary) / 0.2)",
};

export type RadiusToken = "control" | "card" | "sheet";

export const RADIUS_SCALE: Record<RadiusToken, string> = {
  control: "var(--radius-control)",
  card: "var(--radius-card)",
  sheet: "var(--radius-sheet)",
};

// ── Contrat de contraste (vérifié par src/lib/__tests__/design-tokens-contrast.test.ts) ──
/** Fonds sur lesquels chaque token de texte doit atteindre 4,5:1, en clair et en sombre. */
export const SURFACE_TOKENS = ["background", "page", "card", "muted"] as const;

/** Tokens de texte lisibles sur chacun des fonds ci-dessus. */
export const TEXT_TOKENS = [
  "foreground",
  "muted-foreground",
  "brand",
  "success-text",
  "warning-text",
  "destructive-text",
  "info-text",
] as const;

/** Paires tonales : texte de statut sur sa propre teinte. */
export const SUBTLE_PAIRS: ReadonlyArray<readonly [text: string, surface: string]> = [
  ["success-text", "success-subtle"],
  ["warning-text", "warning-subtle"],
  ["destructive-text", "destructive-subtle"],
  ["info-text", "info-subtle"],
];

/** Paires pleines : texte d'action sur son aplat, au repos et au survol. */
export const SOLID_PAIRS: ReadonlyArray<readonly [text: string, surface: string]> = [
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["destructive-foreground", "destructive"],
  ["destructive-foreground", "destructive-hover"],
  ["success-foreground", "success"],
  ["success-foreground", "success-hover"],
  ["warning-foreground", "warning"],
  ["warning-foreground", "warning-hover"],
];

// ── Tons de statut (classes dans src/components/ui/status-badge.tsx) ──
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  PENDING: "warning",
  ACCEPTED: "info",
  PREPARING: "info",
  READY: "success",
  PICKED_UP: "neutral",
  COMPLETED: "neutral",
  DENIED: "danger",
  CANCELLED: "neutral",
  AUTO_CANCELLED: "neutral",
  PARTIALLY_DENIED: "warning",
};

export const SHOP_STATUS_TONE: Record<ShopStatus, StatusTone> = {
  OPEN: "success",
  BUSY: "warning",
  PAUSED: "danger",
  AUTO_PAUSED: "danger",
  CLOSED: "neutral",
  VACATION: "info",
};


// ── Classes héritées des pastilles de statut (pages webmaster ; émises car src/lib est dans le content Tailwind) ──────────────
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

const ORDER_LABELS: Record<OrderStatus, string> = {
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
export const ORDER_STATUS_LABELS: Record<string, string> = ORDER_LABELS;

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

// ── Shop Status Colors ──────────────────────────────
export const SHOP_STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  BUSY:        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PAUSED:      "bg-red-500/10 text-red-500",
  AUTO_PAUSED: "bg-red-500/10 text-red-500",
  CLOSED:      "bg-gray-500/10 text-gray-500",
  VACATION:    "bg-blue-500/10 text-blue-500",
};

const SHOP_LABELS: Record<ShopStatus, string> = {
  OPEN:        "Ouvert",
  BUSY:        "Occupé",
  PAUSED:      "En pause",
  AUTO_PAUSED: "Auto-pause",
  CLOSED:      "Fermé",
  VACATION:    "Vacances",
};
export const SHOP_STATUS_LABELS: Record<string, string> = SHOP_LABELS;
