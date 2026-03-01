// src/lib/price-adjustment-config.ts — Client-safe constants + types for price adjustment tiers
// No server imports here — safe for "use client" components

// ── Default values (used as fallback when DB config is missing) ──

/** Tier 1 max increase percent (auto-approved) */
export const TIER_1_MAX = 10;

/** Tier 2 max increase percent (auto-approved after delay) */
export const TIER_2_MAX = 20;

/** Tier 2 auto-approve delay in seconds */
export const TIER_2_AUTO_APPROVE_SEC = 30;

/** Tier 3 escalation delay in minutes */
export const TIER_3_ESCALATION_MIN = 10;

/** Hard cap safety net (max increase %) */
export const MAX_INCREASE_PCT = 50;

// ── PlatformConfig keys ──

export const PA_KEYS = {
  tier1MaxPct: "pa_tier1_max_pct",
  tier2MaxPct: "pa_tier2_max_pct",
  tier2AutoApproveSec: "pa_tier2_auto_approve_sec",
  tier3EscalationMin: "pa_tier3_escalation_min",
  maxIncreasePct: "pa_max_increase_pct",
  requireReason: "pa_require_reason",
  defaultReasons: "pa_default_reasons",
  maxAdjustmentsPerOrder: "pa_max_adjustments_per_order",
  enableAutoApprove: "pa_enable_auto_approve",
} as const;

// ── Type ──

export type PriceAdjConfig = {
  tier1MaxPct: number;
  tier2MaxPct: number;
  tier2AutoApproveSec: number;
  tier3EscalationMin: number;
  maxIncreasePct: number;
  requireReason: boolean;
  defaultReasons: string[];
  maxAdjustmentsPerOrder: number;
  enableAutoApprove: boolean;
};

// ── Defaults ──

export const PA_DEFAULTS: PriceAdjConfig = {
  tier1MaxPct: TIER_1_MAX,
  tier2MaxPct: TIER_2_MAX,
  tier2AutoApproveSec: TIER_2_AUTO_APPROVE_SEC,
  tier3EscalationMin: TIER_3_ESCALATION_MIN,
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
    tier1MaxPct: num(PA_KEYS.tier1MaxPct, PA_DEFAULTS.tier1MaxPct),
    tier2MaxPct: num(PA_KEYS.tier2MaxPct, PA_DEFAULTS.tier2MaxPct),
    tier2AutoApproveSec: num(PA_KEYS.tier2AutoApproveSec, PA_DEFAULTS.tier2AutoApproveSec),
    tier3EscalationMin: num(PA_KEYS.tier3EscalationMin, PA_DEFAULTS.tier3EscalationMin),
    maxIncreasePct: num(PA_KEYS.maxIncreasePct, PA_DEFAULTS.maxIncreasePct),
    requireReason: bool(PA_KEYS.requireReason, PA_DEFAULTS.requireReason),
    defaultReasons: jsonArr(PA_KEYS.defaultReasons, PA_DEFAULTS.defaultReasons),
    maxAdjustmentsPerOrder: num(PA_KEYS.maxAdjustmentsPerOrder, PA_DEFAULTS.maxAdjustmentsPerOrder),
    enableAutoApprove: bool(PA_KEYS.enableAutoApprove, PA_DEFAULTS.enableAutoApprove),
  };
}
