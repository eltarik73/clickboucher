// src/lib/price-adjustment-config.ts — Client-safe constants for price adjustment tiers
// No server imports here — safe for "use client" components

/** Tier 1 max increase percent (auto-approved) */
export const TIER_1_MAX = 10;

/** Tier 2 max increase percent (auto-approved after 30s) */
export const TIER_2_MAX = 20;

/** Tier 2 auto-approve delay in seconds */
export const TIER_2_AUTO_APPROVE_SEC = 30;

/** Tier 3 escalation delay in minutes */
export const TIER_3_ESCALATION_MIN = 10;

/** Hard cap safety net (max increase %) */
export const MAX_INCREASE_PCT = 50;
