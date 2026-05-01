// @vitest-environment node
//
// Marketing segments — pure helper that decides whether a client is allowed
// to redeem an offer based on their NEW/REGULAR/LOYAL/VIP segment.
// We only test the pure `isSegmentEligible`; `getClientSegment` hits Prisma.

import { describe, it, expect } from "vitest";
import { isSegmentEligible } from "@/lib/marketing/segments";

describe("isSegmentEligible", () => {
  it("ALL audience: every segment can use the offer", () => {
    // The 'ALL' bucket is the open-to-everyone offer used in MarketingBanner
    expect(isSegmentEligible("NEW", "ALL")).toBe(true);
    expect(isSegmentEligible("REGULAR", "ALL")).toBe(true);
    expect(isSegmentEligible("LOYAL", "ALL")).toBe(true);
    expect(isSegmentEligible("VIP", "ALL")).toBe(true);
  });

  it("NEW audience: only first-time clients (segment NEW) qualify", () => {
    // Welcome bonuses must NOT be redeemable by repeat customers
    expect(isSegmentEligible("NEW", "NEW")).toBe(true);
    expect(isSegmentEligible("REGULAR", "NEW")).toBe(false);
    expect(isSegmentEligible("LOYAL", "NEW")).toBe(false);
    expect(isSegmentEligible("VIP", "NEW")).toBe(false);
  });

  it("LOYAL audience: opens to LOYAL and VIP segments only", () => {
    // VIP is treated as a superset of LOYAL — that's the contract callers rely on
    expect(isSegmentEligible("LOYAL", "LOYAL")).toBe(true);
    expect(isSegmentEligible("VIP", "LOYAL")).toBe(true);
    expect(isSegmentEligible("REGULAR", "LOYAL")).toBe(false);
    expect(isSegmentEligible("NEW", "LOYAL")).toBe(false);
  });

  it("VIP audience: only the VIP segment qualifies", () => {
    expect(isSegmentEligible("VIP", "VIP")).toBe(true);
    expect(isSegmentEligible("LOYAL", "VIP")).toBe(false);
  });
});
