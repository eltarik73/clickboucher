// src/lib/price-adjustment.ts — 3-tier price adjustment system (server-only): configuration and tier.
// Applying, refusing and settling adjustments: src/lib/services/orders/adjustment-settlement.ts.
import { getPlatformConfig } from "@/lib/feature-flags";
import {
  TIER_1_MAX as _T1,
  TIER_2_MAX as _T2,
  PA_KEYS,
  parsePriceAdjConfig,
} from "@/lib/price-adjustment-config";
import type { PriceAdjConfig } from "@/lib/price-adjustment-config";

// Re-export constants + types from client-safe config
export {
  TIER_1_MAX,
  TIER_2_MAX,
  TIER_2_AUTO_APPROVE_SEC,
  TIER_3_ESCALATION_MIN,
  MAX_INCREASE_PCT,
} from "@/lib/price-adjustment-config";
export type { PriceAdjConfig } from "@/lib/price-adjustment-config";

/**
 * Load price adjustment config from PlatformConfig (DB-backed, cached 2 min).
 */
export async function getPriceAdjConfig(): Promise<PriceAdjConfig> {
  const keys = Object.values(PA_KEYS);
  const values = await Promise.all(keys.map((k) => getPlatformConfig(k)));
  const raw: Record<string, string | null> = {};
  keys.forEach((k, i) => {
    raw[k] = values[i];
  });
  return parsePriceAdjConfig(raw);
}

/**
 * Compute the tier (1, 2 or 3) for a price adjustment.
 * Price decreases always get tier 1 (auto-approved).
 * Accepts optional thresholds for dynamic config.
 */
export function computeTier(
  originalTotal: number,
  newTotal: number,
  tier1Max: number = _T1,
  tier2Max: number = _T2
): number {
  if (newTotal <= originalTotal) return 1; // Price decrease → always tier 1
  const pct = originalTotal > 0 ? ((newTotal - originalTotal) / originalTotal) * 100 : 0;
  if (pct <= tier1Max) return 1;
  if (pct <= tier2Max) return 2;
  return 3;
}
