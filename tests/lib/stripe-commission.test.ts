// tests/lib/stripe-commission.test.ts — Marketplace commission engine tests
//
// Critical business logic — covers the TVA 5.5% fix (audit I4) plus
// markup gross-up, tier thresholds, early-adopter bonus, and rounding rules.

import { describe, it, expect } from "vitest";
import {
  TIER_THRESHOLDS,
  COMMISSION_FLOOR,
  SERVICE_FEE_CENTS,
  EARLY_ADOPTER_DISCOUNT,
  VAT_RATE_FOOD,
  computeTier,
  getEffectiveCommissionRate,
  computeOnlinePriceCents,
  ttcToHtCents,
  computeOrderCommission,
  computeOrderCommissionFromHt,
  computeOrderFees,
  estimateStripeFeeCents,
} from "@/lib/services/stripe/commission";

describe("computeTier", () => {
  it("returns BRONZE for new shops (GMV = 0)", () => {
    expect(computeTier(0)).toBe("BRONZE");
  });

  it("returns BRONZE just below silver threshold (1999.99€)", () => {
    expect(computeTier(199_999)).toBe("BRONZE");
  });

  it("returns SILVER at exactly 2000€ HT/month", () => {
    expect(computeTier(200_000)).toBe("SILVER");
  });

  it("returns GOLD at exactly 5000€", () => {
    expect(computeTier(500_000)).toBe("GOLD");
  });

  it("returns PLATINUM at exactly 10000€", () => {
    expect(computeTier(1_000_000)).toBe("PLATINUM");
  });

  it("returns PLATINUM for very high GMV (50000€)", () => {
    expect(computeTier(5_000_000)).toBe("PLATINUM");
  });

  it("accepts BigInt inputs (Prisma column type)", () => {
    expect(computeTier(BigInt(0))).toBe("BRONZE");
    expect(computeTier(BigInt(500_000))).toBe("GOLD");
    expect(computeTier(BigInt(1_500_000))).toBe("PLATINUM");
  });
});

describe("getEffectiveCommissionRate", () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  it("returns base rate when no early adopter bonus", () => {
    expect(getEffectiveCommissionRate({ tier: "BRONZE", earlyAdopterUntil: null })).toBe(0.08);
    expect(getEffectiveCommissionRate({ tier: "SILVER", earlyAdopterUntil: null })).toBe(0.07);
    expect(getEffectiveCommissionRate({ tier: "GOLD", earlyAdopterUntil: null })).toBe(0.06);
    expect(getEffectiveCommissionRate({ tier: "PLATINUM", earlyAdopterUntil: null })).toBe(0.05);
  });

  it("applies -2pts early-adopter bonus when active", () => {
    expect(
      getEffectiveCommissionRate({ tier: "BRONZE", earlyAdopterUntil: futureDate }),
    ).toBeCloseTo(0.06, 5);
    expect(
      getEffectiveCommissionRate({ tier: "SILVER", earlyAdopterUntil: futureDate }),
    ).toBeCloseTo(0.05, 5);
  });

  it("clamps at 5% floor — Gold + early adopter doesn't go below 5%", () => {
    expect(
      getEffectiveCommissionRate({ tier: "GOLD", earlyAdopterUntil: futureDate }),
    ).toBe(COMMISSION_FLOOR);
  });

  it("clamps at 5% floor — Platinum + early adopter doesn't go below 5%", () => {
    expect(
      getEffectiveCommissionRate({ tier: "PLATINUM", earlyAdopterUntil: futureDate }),
    ).toBe(COMMISSION_FLOOR);
  });

  it("ignores expired early-adopter dates", () => {
    expect(
      getEffectiveCommissionRate({ tier: "BRONZE", earlyAdopterUntil: pastDate }),
    ).toBe(0.08);
  });
});

describe("computeOnlinePriceCents", () => {
  it("returns 0 for non-positive boutique price", () => {
    expect(computeOnlinePriceCents(0, 0.08, 80)).toBe(0);
    expect(computeOnlinePriceCents(-100, 0.08, 80)).toBe(0);
  });

  it("returns boutique price unchanged when markup=0 (boucher absorbs commission)", () => {
    expect(computeOnlinePriceCents(1400, 0.08, 0)).toBe(1400);
    expect(computeOnlinePriceCents(2999, 0.05, 0)).toBe(2999);
  });

  it("applies gross-up at markup=80% with rounding DOWN to 0.10€", () => {
    // boutique 14€, rate 8%, markup 80%
    // online = 14 / (1 - 0.08*0.80) = 14 / 0.936 ≈ 14,9573€
    // floor(149.573 / 10) * 10 = 1490 cts = 14,90€
    expect(computeOnlinePriceCents(1400, 0.08, 80)).toBe(1490);
  });

  it("applies gross-up at markup=100% (full repercussion)", () => {
    // boutique 10€, rate 8%, markup 100%
    // online = 10 / (1 - 0.08) = 10.8696€ → floor(108.69/10)*10 = 1080 cts
    expect(computeOnlinePriceCents(1000, 0.08, 100)).toBe(1080);
  });

  it("applies gross-up at markup=50%", () => {
    // boutique 20€, rate 6%, markup 50%
    // online = 20 / (1 - 0.06*0.5) = 20 / 0.97 ≈ 20.6186€ → 20,60€
    expect(computeOnlinePriceCents(2000, 0.06, 50)).toBe(2060);
  });

  it("applies gross-up at markup=30%", () => {
    // boutique 12€, rate 5%, markup 30%
    // online = 12 / (1 - 0.05*0.3) = 12 / 0.985 ≈ 12.1827€ → 12,10€
    expect(computeOnlinePriceCents(1200, 0.05, 30)).toBe(1210);
  });

  it("uses cent precision when roundingEnabled=false", () => {
    // boutique 14€, rate 8%, markup 80% → 1495.726... rounded to 1496
    expect(computeOnlinePriceCents(1400, 0.08, 80, false)).toBe(1496);
  });

  it("guards against denominator <= 0 (returns boutique price)", () => {
    // markup 100% with rate=1 (impossible but defensive)
    expect(computeOnlinePriceCents(1000, 1.0, 100)).toBe(1000);
    expect(computeOnlinePriceCents(1000, 1.5, 100)).toBe(1000);
  });
});

describe("ttcToHtCents", () => {
  it("returns 0 for non-positive input", () => {
    expect(ttcToHtCents(0)).toBe(0);
    expect(ttcToHtCents(-100)).toBe(0);
  });

  it("converts 10,55€ TTC to 10€ HT (round-trip exact)", () => {
    // 10€ HT × 1.055 = 10,55€ TTC → / 1.055 = 10€ HT
    expect(ttcToHtCents(1055)).toBe(1000);
  });

  it("converts 100€ TTC at 5.5% TVA", () => {
    // 100 / 1.055 ≈ 94.7867€ HT → 9479 cts (rounded)
    expect(ttcToHtCents(10_000)).toBe(9479);
  });

  it("uses VAT_RATE_FOOD constant (5.5%)", () => {
    expect(VAT_RATE_FOOD).toBe(0.055);
  });
});

describe("computeOrderCommission — TVA fix (audit I4)", () => {
  it("applies commission on HT, NOT on TTC", () => {
    // 100€ TTC = 94,79€ HT → 8% commission = 7,58€
    // Wrong (TTC-based) would be 8€ → boucher loses 0,42€ in TVA
    expect(computeOrderCommission(10_000, 0.08)).toBe(758);
  });

  it("returns 0 for non-positive subtotal", () => {
    expect(computeOrderCommission(0, 0.08)).toBe(0);
    expect(computeOrderCommission(-100, 0.08)).toBe(0);
  });

  it("PLATINUM tier with early adopter (5%) on 100€ TTC", () => {
    // 100€ TTC → 94,79€ HT × 5% = 4,7395€ → 474 cts
    expect(computeOrderCommission(10_000, 0.05)).toBe(474);
  });
});

describe("computeOrderCommissionFromHt", () => {
  it("applies rate directly on HT amount", () => {
    expect(computeOrderCommissionFromHt(10_000, 0.08)).toBe(800);
    expect(computeOrderCommissionFromHt(10_000, 0.05)).toBe(500);
  });

  it("returns 0 for non-positive input", () => {
    expect(computeOrderCommissionFromHt(0, 0.08)).toBe(0);
    expect(computeOrderCommissionFromHt(-100, 0.08)).toBe(0);
  });
});

describe("computeOrderFees", () => {
  it("decomposes a 100€ TTC order at 8% rate", () => {
    const fees = computeOrderFees({
      orderSubtotalCents: 10_000,
      effectiveCommissionRate: 0.08,
    });
    expect(fees.subtotalCents).toBe(10_000);
    expect(fees.commissionCents).toBe(758); // 100 / 1.055 * 8% rounded
    expect(fees.serviceFeeCents).toBe(SERVICE_FEE_CENTS); // 99
    expect(fees.platformFeeCents).toBe(857); // 758 + 99
    expect(fees.shopPayoutCents).toBe(9242); // 10000 - 758 (boucher keeps TVA)
    expect(fees.totalToPayCents).toBe(10_099); // 10000 + 99
  });

  it("decomposes a 50€ TTC order at PLATINUM 5%", () => {
    const fees = computeOrderFees({
      orderSubtotalCents: 5000,
      effectiveCommissionRate: 0.05,
    });
    expect(fees.commissionCents).toBe(237); // 50/1.055 * 5% = 2.37
    expect(fees.platformFeeCents).toBe(336); // 237 + 99
    expect(fees.shopPayoutCents).toBe(4763); // 5000 - 237
    expect(fees.totalToPayCents).toBe(5099);
  });

  it("commission + payout = subtotal (no money lost)", () => {
    const fees = computeOrderFees({
      orderSubtotalCents: 12_345,
      effectiveCommissionRate: 0.07,
    });
    expect(fees.commissionCents + fees.shopPayoutCents).toBe(fees.subtotalCents);
  });

  it("totalToPay = subtotal + service fee", () => {
    const fees = computeOrderFees({
      orderSubtotalCents: 7531,
      effectiveCommissionRate: 0.06,
    });
    expect(fees.totalToPayCents).toBe(fees.subtotalCents + SERVICE_FEE_CENTS);
  });
});

describe("estimateStripeFeeCents", () => {
  it("returns 0 for non-positive amount", () => {
    expect(estimateStripeFeeCents(0)).toBe(0);
    expect(estimateStripeFeeCents(-100)).toBe(0);
  });

  it("computes 1.4% + 0.25€ for FR cards", () => {
    // 50€ → 0.7€ + 0.25€ = 0.95€ = 95 cts
    expect(estimateStripeFeeCents(5000)).toBe(95);
    // 100€ → 1.4€ + 0.25€ = 1.65€ = 165 cts
    expect(estimateStripeFeeCents(10_000)).toBe(165);
  });
});

describe("Boundary conditions & invariants", () => {
  it("commission never below 5% floor regardless of tier+bonus", () => {
    const tiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
    const earlyAdopter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (const tier of tiers) {
      const rate = getEffectiveCommissionRate({ tier, earlyAdopterUntil: earlyAdopter });
      expect(rate).toBeGreaterThanOrEqual(COMMISSION_FLOOR);
    }
  });

  it("online price >= boutique price for any markup > 0", () => {
    const boutique = 1500;
    for (const markup of [30, 50, 80, 100]) {
      const online = computeOnlinePriceCents(boutique, 0.08, markup);
      expect(online).toBeGreaterThanOrEqual(boutique);
    }
  });

  it("commission rate constants match documented model", () => {
    expect(TIER_THRESHOLDS.BRONZE.rate).toBe(0.08);
    expect(TIER_THRESHOLDS.SILVER.rate).toBe(0.07);
    expect(TIER_THRESHOLDS.GOLD.rate).toBe(0.06);
    expect(TIER_THRESHOLDS.PLATINUM.rate).toBe(0.05);
    expect(COMMISSION_FLOOR).toBe(0.05);
    expect(SERVICE_FEE_CENTS).toBe(99);
    expect(EARLY_ADOPTER_DISCOUNT).toBe(0.02);
  });
});
