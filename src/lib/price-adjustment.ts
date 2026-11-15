// src/lib/price-adjustment.ts — platform configuration of price adjustments (server-only).
// Whether an adjustment applies at once or needs the customer's answer is decided by the weighing
// tolerance frozen on the order (decideAdjustment, src/lib/pricing/tolerance.ts); applying,
// refusing and closing adjustments: src/lib/services/orders/adjustment-settlement.ts.
import { getPlatformConfig } from "@/lib/feature-flags";
import { PA_KEYS, parsePriceAdjConfig } from "@/lib/price-adjustment-config";
import type { PriceAdjConfig } from "@/lib/price-adjustment-config";

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
