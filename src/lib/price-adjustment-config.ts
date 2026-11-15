// src/lib/price-adjustment-config.ts — the platform's setting of price adjustments, client-safe
// (no server imports: read by "use client" components). One setting remains: the safety cap of one
// adjustment, in % of the order's current total. Whether an adjustment applies without asking the
// customer is not a setting: it is the weighing tolerance the customer chose, frozen on the order
// (src/lib/pricing/tolerance.ts).
import { z } from "zod";

/** Safety cap of one adjustment, in % of the current total, when platform_config holds none. */
export const MAX_INCREASE_PCT = 50;

/** The PlatformConfig key of the setting. */
export const PA_KEYS = {
  maxIncreasePct: "pa_max_increase_pct",
} as const;

/** What the webmaster may store as the cap: a whole percentage from 1 to 100. */
export const maxIncreasePctSchema = z
  .number({ invalid_type_error: "Le plafond est un nombre de pourcents" })
  .int("Le plafond est un nombre entier de pourcents")
  .min(1, "Le plafond est d'au moins 1 %")
  .max(100, "Le plafond est d'au plus 100 %");

export type PriceAdjConfig = {
  maxIncreasePct: number;
};

export const PA_DEFAULTS: PriceAdjConfig = {
  maxIncreasePct: MAX_INCREASE_PCT,
};

/** String values from platform_config -> typed setting; the default when the row is missing. */
export function parsePriceAdjConfig(
  raw: Record<string, string | null | undefined>
): PriceAdjConfig {
  const stored = raw[PA_KEYS.maxIncreasePct];
  if (stored == null || stored === "") return PA_DEFAULTS;
  const value = Number(stored);
  return { maxIncreasePct: isNaN(value) ? PA_DEFAULTS.maxIncreasePct : value };
}
