// @vitest-environment node
//
// The platform's setting of price adjustments: only the safety cap of one adjustment remains. The
// former settings (automatic validation, mandatory reason, default reasons, number of adjustments
// per order) were read by no code; the automatic validation itself is gone (C1-PAIEMENT-A, D-A8).
import { describe, expect, it } from "vitest";
import {
  MAX_INCREASE_PCT,
  PA_DEFAULTS,
  PA_KEYS,
  maxIncreasePctSchema,
  parsePriceAdjConfig,
} from "@/lib/price-adjustment-config";

describe("the price adjustment setting", () => {
  it("is the safety cap alone, stored under pa_max_increase_pct", () => {
    expect(PA_KEYS).toEqual({ maxIncreasePct: "pa_max_increase_pct" });
    expect(PA_DEFAULTS).toEqual({ maxIncreasePct: 50 });
    expect(MAX_INCREASE_PCT).toBe(50);
  });

  it("reads the stored cap, the default when the row is missing or not a number", () => {
    expect(parsePriceAdjConfig({ pa_max_increase_pct: "30" })).toEqual({ maxIncreasePct: 30 });
    expect(parsePriceAdjConfig({})).toEqual({ maxIncreasePct: 50 });
    expect(parsePriceAdjConfig({ pa_max_increase_pct: "" })).toEqual({ maxIncreasePct: 50 });
    expect(parsePriceAdjConfig({ pa_max_increase_pct: "abc" })).toEqual({ maxIncreasePct: 50 });
  });

  it("ignores the former settings still stored in platform_config", () => {
    const stored = {
      pa_max_increase_pct: "40",
      pa_enable_auto_approve: "true",
      pa_require_reason: "true",
      pa_default_reasons: '["Poids réel différent"]',
      pa_max_adjustments_per_order: "3",
    };
    expect(parsePriceAdjConfig(stored)).toEqual({ maxIncreasePct: 40 });
  });

  it("accepts a whole percentage from 1 to 100, in French otherwise", () => {
    expect(maxIncreasePctSchema.parse(1)).toBe(1);
    expect(maxIncreasePctSchema.parse(100)).toBe(100);
    const message = (value: unknown) =>
      maxIncreasePctSchema.safeParse(value).error?.issues[0]?.message;
    expect(message(0)).toBe("Le plafond est d'au moins 1 %");
    expect(message(101)).toBe("Le plafond est d'au plus 100 %");
    expect(message(12.5)).toBe("Le plafond est un nombre entier de pourcents");
    expect(message("40")).toBe("Le plafond est un nombre de pourcents");
  });
});
