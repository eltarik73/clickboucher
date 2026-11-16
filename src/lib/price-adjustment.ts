// src/lib/price-adjustment.ts — the safety cap of one price adjustment as the server applies it
// (server-only: platform_config). Whether an adjustment applies at once or needs the customer's
// answer is decided by the weighing tolerance frozen on the order (decideAdjustment,
// src/lib/pricing/tolerance.ts).
import { getPlatformConfig } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import {
  MAX_INCREASE_PCT,
  MAX_INCREASE_PCT_KEY,
  parseMaxIncreasePct,
} from "@/lib/price-adjustment-config";

/**
 * The cap in % of the order's current total: the stored one, else MAX_INCREASE_PCT. A stored value
 * that breaks the rule (written before it, or by hand) is never applied: the default is, with a
 * warning. Cached 2 minutes per instance by getPlatformConfig.
 */
export async function getMaxIncreasePct(): Promise<number> {
  const stored = await getPlatformConfig(MAX_INCREASE_PCT_KEY);
  if (stored === null) return MAX_INCREASE_PCT;
  const cap = parseMaxIncreasePct(stored);
  if (cap.success) return cap.data;
  logger.warn("[price-adjustment] stored cap refused, default applied", {
    key: MAX_INCREASE_PCT_KEY,
    stored,
    applied: MAX_INCREASE_PCT,
  });
  return MAX_INCREASE_PCT;
}
