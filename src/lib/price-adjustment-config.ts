// src/lib/price-adjustment-config.ts — Client-safe constants + types of the platform settings of
// price adjustments. No server imports here — safe for "use client" components.
// Whether an adjustment applies without asking the customer is not a setting: it is the weighing
// tolerance the customer chose, frozen on the order (src/lib/pricing/tolerance.ts).

// ── Default values (used as fallback when DB config is missing) ──

/** Hard cap safety net (max increase %) */
export const MAX_INCREASE_PCT = 50;

// ── PlatformConfig keys ──

export const PA_KEYS = {
  maxIncreasePct: "pa_max_increase_pct",
  requireReason: "pa_require_reason",
  defaultReasons: "pa_default_reasons",
  maxAdjustmentsPerOrder: "pa_max_adjustments_per_order",
  enableAutoApprove: "pa_enable_auto_approve",
} as const;

// ── Type ──

export type PriceAdjConfig = {
  maxIncreasePct: number;
  requireReason: boolean;
  defaultReasons: string[];
  maxAdjustmentsPerOrder: number;
  enableAutoApprove: boolean;
};

// ── Defaults ──

export const PA_DEFAULTS: PriceAdjConfig = {
  maxIncreasePct: MAX_INCREASE_PCT,
  requireReason: true,
  defaultReasons: [
    "Poids réel différent",
    "Rupture produit",
    "Erreur de prix catalogue",
    "Ajustement découpe",
  ],
  maxAdjustmentsPerOrder: 3,
  enableAutoApprove: true,
};

// ── Parser (string values from DB → typed config) ──

export function parsePriceAdjConfig(
  raw: Record<string, string | null | undefined>
): PriceAdjConfig {
  const num = (key: string, fallback: number) => {
    const v = raw[key];
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  const bool = (key: string, fallback: boolean) => {
    const v = raw[key];
    if (v == null || v === "") return fallback;
    return v === "true" || v === "1";
  };

  const jsonArr = (key: string, fallback: string[]) => {
    const v = raw[key];
    if (v == null || v === "") return fallback;
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    maxIncreasePct: num(PA_KEYS.maxIncreasePct, PA_DEFAULTS.maxIncreasePct),
    requireReason: bool(PA_KEYS.requireReason, PA_DEFAULTS.requireReason),
    defaultReasons: jsonArr(PA_KEYS.defaultReasons, PA_DEFAULTS.defaultReasons),
    maxAdjustmentsPerOrder: num(PA_KEYS.maxAdjustmentsPerOrder, PA_DEFAULTS.maxAdjustmentsPerOrder),
    enableAutoApprove: bool(PA_KEYS.enableAutoApprove, PA_DEFAULTS.enableAutoApprove),
  };
}
