// src/lib/price-adjustment-config.ts — the platform's setting of price adjustments, client-safe
// (no server imports: the webmaster's settings page names the key). One setting: the safety cap of
// one adjustment, in % of the order's current total. Whether an adjustment applies without asking
// the customer is not a setting: it is the weighing tolerance the customer chose, frozen on the
// order (src/lib/pricing/tolerance.ts).
import { z } from "zod";

/** Safety cap of one adjustment, in % of the current total, when platform_config holds no valid one. */
export const MAX_INCREASE_PCT = 50;

/** The platform_config key of the cap. */
export const MAX_INCREASE_PCT_KEY = "pa_max_increase_pct";

const maxIncreasePctSchema = z
  .number({ invalid_type_error: "Le plafond est un nombre de pourcents" })
  .int("Le plafond est un nombre entier de pourcents")
  .min(1, "Le plafond est d'au moins 1 %")
  .max(100, "Le plafond est d'au plus 100 %");

/**
 * A cap as platform_config stores it (a string), read with Number() then held to the rule: a whole
 * percentage from 1 to 100. The same parse decides the webmaster's write (PATCH
 * /api/webmaster/config, which answers its French message) and the server's read
 * (getMaxIncreasePct, src/lib/price-adjustment.ts).
 */
export function parseMaxIncreasePct(stored: string): z.SafeParseReturnType<number, number> {
  return maxIncreasePctSchema.safeParse(Number(stored));
}
