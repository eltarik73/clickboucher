// @vitest-environment node
//
// Discount amounts and offer predicates. The amount is always computed here, on
// the server, from the offer row and the recomputed subtotal: the browser sends
// a code and nothing else. Before this module a 150 % offer, a « 1+1 » on a
// per-kg product or an unconditional bundle amount could make an order free,
// and « frais offerts » took 0,99 EUR off the butcher's goods.

import { describe, it, expect } from "vitest";
import {
  loyaltyRewardDiscount,
  offerAppliesToShop,
  offerDiscount,
  offerWindow,
  type DiscountAmount,
  type OfferKind,
  type OfferWindow,
} from "@/lib/pricing/discount";

type Offer = { type: OfferKind; discountValue: number; minOrder: number };
type Basket = { subtotalCents: number; serviceFeeCents: number };

describe("offerDiscount", () => {
  it.each<[string, Offer, Basket, DiscountAmount]>([
    [
      "PERCENT 10 on 21,78 EUR is 2,18 EUR (217,8 rounds up)",
      { type: "PERCENT", discountValue: 10, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: true, discountCents: 218, waivesServiceFee: false },
    ],
    [
      "PERCENT 5 on 8,48 EUR is 0,42 EUR (42,4 rounds down)",
      { type: "PERCENT", discountValue: 5, minOrder: 0 },
      { subtotalCents: 848, serviceFeeCents: 0 },
      { ok: true, discountCents: 42, waivesServiceFee: false },
    ],
    [
      "PERCENT 50 on 9,99 EUR is 5,00 EUR (499,5 rounds up)",
      { type: "PERCENT", discountValue: 50, minOrder: 0 },
      { subtotalCents: 999, serviceFeeCents: 0 },
      { ok: true, discountCents: 500, waivesServiceFee: false },
    ],
    [
      "PERCENT 1 is the smallest percentage",
      { type: "PERCENT", discountValue: 1, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: true, discountCents: 22, waivesServiceFee: false },
    ],
    [
      "PERCENT 100 takes the whole subtotal and no more",
      { type: "PERCENT", discountValue: 100, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: true, discountCents: 2178, waivesServiceFee: false },
    ],
    [
      "PERCENT 12,5 on 21,80 EUR is 2,73 EUR (272,5 rounds up)",
      { type: "PERCENT", discountValue: 12.5, minOrder: 0 },
      { subtotalCents: 2180, serviceFeeCents: 0 },
      { ok: true, discountCents: 273, waivesServiceFee: false },
    ],
    [
      "PERCENT 7,25 on 100,00 EUR is 7,25 EUR",
      { type: "PERCENT", discountValue: 7.25, minOrder: 0 },
      { subtotalCents: 10_000, serviceFeeCents: 0 },
      { ok: true, discountCents: 725, waivesServiceFee: false },
    ],
    [
      "PERCENT leaves the service fee alone",
      { type: "PERCENT", discountValue: 10, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 99 },
      { ok: true, discountCents: 218, waivesServiceFee: false },
    ],
    [
      "PERCENT 150 is refused",
      { type: "PERCENT", discountValue: 150, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "PERCENT 100,01 is refused",
      { type: "PERCENT", discountValue: 100.01, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "PERCENT 0 is refused",
      { type: "PERCENT", discountValue: 0, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "PERCENT 0,5 is refused",
      { type: "PERCENT", discountValue: 0.5, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a negative PERCENT is refused",
      { type: "PERCENT", discountValue: -10, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a PERCENT with more than two decimals is refused",
      { type: "PERCENT", discountValue: 33.333, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a NaN PERCENT is refused",
      { type: "PERCENT", discountValue: Number.NaN, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "AMOUNT 5 EUR on 3,00 EUR is capped at 3,00 EUR",
      { type: "AMOUNT", discountValue: 5, minOrder: 0 },
      { subtotalCents: 300, serviceFeeCents: 0 },
      { ok: true, discountCents: 300, waivesServiceFee: false },
    ],
    [
      "AMOUNT 5 EUR on 21,78 EUR is 5,00 EUR",
      { type: "AMOUNT", discountValue: 5, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: true, discountCents: 500, waivesServiceFee: false },
    ],
    [
      "AMOUNT 4,35 EUR is 435 cents (4.35 * 100 is 434,99999999999994 in binary)",
      { type: "AMOUNT", discountValue: 4.35, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: true, discountCents: 435, waivesServiceFee: false },
    ],
    [
      "AMOUNT 0 is refused",
      { type: "AMOUNT", discountValue: 0, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a negative AMOUNT is refused",
      { type: "AMOUNT", discountValue: -5, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "an infinite AMOUNT is refused",
      { type: "AMOUNT", discountValue: Number.POSITIVE_INFINITY, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a minimum of 20 EUR is not reached at 8,48 EUR",
      { type: "PERCENT", discountValue: 10, minOrder: 20 },
      { subtotalCents: 848, serviceFeeCents: 0 },
      { ok: false, reason: "MIN_ORDER_NOT_REACHED", minOrderCents: 2000 },
    ],
    [
      "a minimum of 20 EUR is not reached at 19,99 EUR",
      { type: "AMOUNT", discountValue: 5, minOrder: 20 },
      { subtotalCents: 1999, serviceFeeCents: 0 },
      { ok: false, reason: "MIN_ORDER_NOT_REACHED", minOrderCents: 2000 },
    ],
    [
      "a minimum of 20 EUR is reached at exactly 20,00 EUR",
      { type: "AMOUNT", discountValue: 5, minOrder: 20 },
      { subtotalCents: 2000, serviceFeeCents: 0 },
      { ok: true, discountCents: 500, waivesServiceFee: false },
    ],
    [
      "a minimum of 19,99 EUR is 1999 cents",
      { type: "PERCENT", discountValue: 10, minOrder: 19.99 },
      { subtotalCents: 1998, serviceFeeCents: 0 },
      { ok: false, reason: "MIN_ORDER_NOT_REACHED", minOrderCents: 1999 },
    ],
    [
      "a negative minimum is a broken offer",
      { type: "PERCENT", discountValue: 10, minOrder: -1 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "BOGO is not usable online",
      { type: "BOGO", discountValue: 0, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" },
    ],
    [
      "BUNDLE is not usable online",
      { type: "BUNDLE", discountValue: 15, minOrder: 0 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" },
    ],
    [
      "BUNDLE is refused before its minimum is looked at",
      { type: "BUNDLE", discountValue: 15, minOrder: 50 },
      { subtotalCents: 530, serviceFeeCents: 0 },
      { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" },
    ],
    [
      "FREE_FEES has nothing to waive on an order without service fee",
      { type: "FREE_FEES", discountValue: 0.99, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "NO_SERVICE_FEE_TO_WAIVE" },
    ],
    [
      "FREE_FEES without fee is refused for good, whatever the minimum",
      { type: "FREE_FEES", discountValue: 0.99, minOrder: 50 },
      { subtotalCents: 2178, serviceFeeCents: 0 },
      { ok: false, reason: "NO_SERVICE_FEE_TO_WAIVE" },
    ],
    [
      "FREE_FEES waives a 0,99 EUR fee and never discounts the goods",
      { type: "FREE_FEES", discountValue: 0.99, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 99 },
      { ok: true, discountCents: 0, waivesServiceFee: true },
    ],
    [
      "FREE_FEES ignores its stored value",
      { type: "FREE_FEES", discountValue: 0, minOrder: 0 },
      { subtotalCents: 2178, serviceFeeCents: 99 },
      { ok: true, discountCents: 0, waivesServiceFee: true },
    ],
    [
      "FREE_FEES still needs its minimum",
      { type: "FREE_FEES", discountValue: 0.99, minOrder: 30 },
      { subtotalCents: 2178, serviceFeeCents: 99 },
      { ok: false, reason: "MIN_ORDER_NOT_REACHED", minOrderCents: 3000 },
    ],
  ])("%s", (_label, offer, basket, expected) => {
    expect(offerDiscount(offer, basket)).toStrictEqual(expected);
  });

  it("should never discount more than the subtotal nor return a fraction of a cent", () => {
    for (const subtotalCents of [0, 1, 99, 530, 848, 2178, 99_999]) {
      for (let pct = 1; pct <= 100; pct += 1) {
        const result = offerDiscount(
          { type: "PERCENT", discountValue: pct, minOrder: 0 },
          { subtotalCents, serviceFeeCents: 0 }
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Number.isInteger(result.discountCents)).toBe(true);
        expect(result.discountCents).toBeGreaterThanOrEqual(0);
        expect(result.discountCents).toBeLessThanOrEqual(subtotalCents);
        expect(result.discountCents).toBe(Math.floor((subtotalCents * pct + 50) / 100));
      }
    }
  });

  it("should read every percentage with two decimals exactly, whatever its binary form", () => {
    // On 100,00 EUR the discount in cents is the percentage in hundredths.
    for (let hundredths = 100; hundredths <= 10_000; hundredths += 1) {
      const result = offerDiscount(
        { type: "PERCENT", discountValue: hundredths / 100, minOrder: 0 },
        { subtotalCents: 10_000, serviceFeeCents: 0 }
      );
      expect(result, `${hundredths / 100} %`).toStrictEqual({
        ok: true,
        discountCents: hundredths,
        waivesServiceFee: false,
      });
    }
  });

  it("should read every amount in euros as whole cents, whatever its binary form", () => {
    for (let cents = 1; cents <= 20_000; cents += 1) {
      const result = offerDiscount(
        { type: "AMOUNT", discountValue: cents / 100, minOrder: cents / 100 },
        { subtotalCents: 20_000, serviceFeeCents: 0 }
      );
      expect(result, `${cents / 100} EUR`).toStrictEqual({
        ok: true,
        discountCents: cents,
        waivesServiceFee: false,
      });
    }
  });

  it.each<[string, Basket]>([
    ["a negative subtotal", { subtotalCents: -1, serviceFeeCents: 0 }],
    ["a fractional subtotal", { subtotalCents: 21.78, serviceFeeCents: 0 }],
    ["a negative service fee", { subtotalCents: 2178, serviceFeeCents: -99 }],
    ["a fractional service fee", { subtotalCents: 2178, serviceFeeCents: 0.99 }],
  ])("should throw RangeError on %s", (_label, basket) => {
    expect(() =>
      offerDiscount({ type: "PERCENT", discountValue: 10, minOrder: 0 }, basket)
    ).toThrow(RangeError);
  });
});

describe("loyaltyRewardDiscount", () => {
  type Reward = { rewardType: string; rewardCents: number | null; rewardPercent: number | null };

  it.each<[string, Reward, number, DiscountAmount]>([
    [
      "a 2 EUR reward",
      { rewardType: "FIXED", rewardCents: 200, rewardPercent: null },
      2178,
      { ok: true, discountCents: 200, waivesServiceFee: false },
    ],
    [
      "a 10 EUR reward on 8,48 EUR is capped at 8,48 EUR",
      { rewardType: "FIXED", rewardCents: 1000, rewardPercent: null },
      848,
      { ok: true, discountCents: 848, waivesServiceFee: false },
    ],
    [
      "a 10 % reward is computed like a PERCENT offer",
      { rewardType: "PERCENT", rewardCents: null, rewardPercent: 10 },
      2178,
      { ok: true, discountCents: 218, waivesServiceFee: false },
    ],
    [
      "a fixed reward without amount",
      { rewardType: "FIXED", rewardCents: null, rewardPercent: null },
      2178,
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a fixed reward of 0",
      { rewardType: "FIXED", rewardCents: 0, rewardPercent: null },
      2178,
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a fixed reward ignores a leftover percentage",
      { rewardType: "FIXED", rewardCents: null, rewardPercent: 10 },
      2178,
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a percentage reward without percentage",
      { rewardType: "PERCENT", rewardCents: 500, rewardPercent: null },
      2178,
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "a 150 % reward",
      { rewardType: "PERCENT", rewardCents: null, rewardPercent: 150 },
      2178,
      { ok: false, reason: "INVALID_OFFER_VALUE" },
    ],
    [
      "an unknown reward type",
      { rewardType: "AMOUNT", rewardCents: 500, rewardPercent: null },
      2178,
      { ok: false, reason: "UNSUPPORTED_OFFER_TYPE" },
    ],
  ])("%s", (_label, reward, subtotalCents, expected) => {
    expect(loyaltyRewardDiscount(reward, subtotalCents)).toStrictEqual(expected);
  });

  it("should throw RangeError on a subtotal that is not whole cents", () => {
    const reward = { rewardType: "FIXED", rewardCents: 200, rewardPercent: null };
    expect(() => loyaltyRewardDiscount(reward, -1)).toThrow(RangeError);
    expect(() => loyaltyRewardDiscount(reward, 21.78)).toThrow(RangeError);
  });
});

describe("offerAppliesToShop", () => {
  const SHOP = "shop_a";
  const OTHER = "shop_b";

  it.each<[string, { shopId: string | null; payer: "KLIKGO" | "BUTCHER" }, boolean, boolean]>([
    ["a shop offer in its own shop", { shopId: SHOP, payer: "BUTCHER" }, false, true],
    ["a shop offer in another shop", { shopId: OTHER, payer: "BUTCHER" }, false, false],
    [
      "a shop offer in another shop, even with an accepted proposal",
      { shopId: OTHER, payer: "BUTCHER" },
      true,
      false,
    ],
    [
      "a shop offer paid by Klik&Go in its own shop",
      { shopId: SHOP, payer: "KLIKGO" },
      false,
      true,
    ],
    [
      "a shop offer paid by Klik&Go in another shop",
      { shopId: OTHER, payer: "KLIKGO" },
      false,
      false,
    ],
    [
      "a platform offer paid by Klik&Go, everywhere",
      { shopId: null, payer: "KLIKGO" },
      false,
      true,
    ],
    [
      "a platform offer paid by the butcher, without accepted proposal",
      { shopId: null, payer: "BUTCHER" },
      false,
      false,
    ],
    [
      "a platform offer paid by the butcher, with an accepted proposal",
      { shopId: null, payer: "BUTCHER" },
      true,
      true,
    ],
  ])("%s", (_label, offer, hasAcceptedProposal, expected) => {
    expect(offerAppliesToShop(offer, SHOP, hasAcceptedProposal)).toBe(expected);
  });
});

describe("offerWindow", () => {
  const NOW = new Date("2026-11-13T10:00:00.000Z");
  const START = new Date("2026-11-01T00:00:00.000Z");
  const END = new Date("2026-11-30T00:00:00.000Z");
  const base = { status: "ACTIVE", startDate: START, endDate: END, maxUses: null, currentUses: 0 };

  it.each<[string, Parameters<typeof offerWindow>[0], OfferWindow]>([
    ["an active offer inside its window, unlimited", base, "OK"],
    ["an offer with uses left", { ...base, maxUses: 10, currentUses: 9 }, "OK"],
    ["an offer starting exactly now", { ...base, startDate: NOW }, "OK"],
    ["a draft", { ...base, status: "DRAFT" }, "NOT_ACTIVE"],
    ["a paused offer", { ...base, status: "PAUSED" }, "NOT_ACTIVE"],
    [
      "a paused offer is not active, even exhausted and past its end",
      { ...base, status: "PAUSED", endDate: START, maxUses: 1, currentUses: 1 },
      "NOT_ACTIVE",
    ],
    [
      "an offer starting tomorrow",
      { ...base, startDate: new Date("2026-11-14T00:00:00.000Z") },
      "NOT_STARTED",
    ],
    [
      "an offer that ended yesterday",
      { ...base, endDate: new Date("2026-11-12T00:00:00.000Z") },
      "EXPIRED",
    ],
    ["an offer ending exactly now is over", { ...base, endDate: NOW }, "EXPIRED"],
    ["an offer whose status is EXPIRED", { ...base, status: "EXPIRED" }, "EXPIRED"],
    ["an offer with every use taken", { ...base, maxUses: 10, currentUses: 10 }, "EXHAUSTED"],
    ["an offer with more uses than allowed", { ...base, maxUses: 1, currentUses: 3 }, "EXHAUSTED"],
    [
      "an expired offer is expired before it is exhausted",
      { ...base, endDate: START, maxUses: 1, currentUses: 1 },
      "EXPIRED",
    ],
  ])("%s", (_label, offer, expected) => {
    expect(offerWindow(offer, NOW)).toBe(expected);
  });

  it("should throw TypeError on a date that is not a date", () => {
    expect(() => offerWindow({ ...base, endDate: new Date("x") }, NOW)).toThrow(TypeError);
    expect(() => offerWindow({ ...base, startDate: new Date("x") }, NOW)).toThrow(TypeError);
    expect(() => offerWindow(base, new Date("x"))).toThrow(TypeError);
  });
});
