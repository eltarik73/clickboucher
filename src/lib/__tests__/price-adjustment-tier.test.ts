// @vitest-environment node
//
// Pure tier classifier from src/lib/price-adjustment.ts. The 3-tier system
// drives the entire customer-facing price-change flow (auto-approve / wait
// for client / escalate). A wrong tier here means either silent overcharges
// or unnecessary escalations to the webmaster.

import { describe, it, expect } from "vitest";
import { computeTier } from "@/lib/price-adjustment";

// Use explicit thresholds to make the math obvious in the test (defaults
// come from PlatformConfig and could drift over time).
const TIER1 = 5; // ≤5% increase → tier 1 (auto-approved)
const TIER2 = 15; // ≤15% increase → tier 2 (client has 5min)

describe("computeTier", () => {
  it("should always return tier 1 for a price decrease (no client wait)", () => {
    // Boucher reducing the bill is friendly — auto-approve every time
    expect(computeTier(10_000, 9_000, TIER1, TIER2)).toBe(1);
    expect(computeTier(10_000, 10_000, TIER1, TIER2)).toBe(1);
  });

  it("should return tier 1 when the increase is within the tier-1 threshold", () => {
    // 100 → 104 = +4% ≤ 5%
    expect(computeTier(10_000, 10_400, TIER1, TIER2)).toBe(1);
  });

  it("should return tier 2 when the increase exceeds tier 1 but stays within tier 2", () => {
    // 100 → 110 = +10% (between 5% and 15%)
    expect(computeTier(10_000, 11_000, TIER1, TIER2)).toBe(2);
  });

  it("should return tier 3 (escalation) when the increase exceeds tier 2", () => {
    // 100 → 120 = +20% > 15% → must escalate to webmaster
    expect(computeTier(10_000, 12_000, TIER1, TIER2)).toBe(3);
  });

  it("should treat a zero original total as 0% (returns tier 1)", () => {
    // Defensive: avoids divide-by-zero blowing up the price-adjust modal
    expect(computeTier(0, 5_000, TIER1, TIER2)).toBe(1);
  });
});
