// @vitest-environment node
import { describe, expect, it } from "vitest";

import { badgeLabelsByShop, offerBadgeLabel } from "@/lib/offer-badge-label";

describe("offerBadgeLabel", () => {
  it.each([
    ["PERCENT", 25, "-25%"],
    ["AMOUNT", 5, "-5€"],
    ["FREE_FEES", 0, "Frais offerts"],
    ["BOGO", 0, "1+1 offert"],
    ["BUNDLE", 0, "Pack"],
  ] as const)("labels a %s offer of %s as %s", (type, discountValue, label) => {
    expect(offerBadgeLabel({ type, discountValue, name: "Nom" })).toBe(label);
  });
});

describe("badgeLabelsByShop", () => {
  it("keeps the first offer of each shop and skips platform offers", () => {
    const labels = badgeLabelsByShop([
      { shopId: null, type: "PERCENT", discountValue: 50, name: "Plateforme" },
      { shopId: "a", type: "PERCENT", discountValue: 20, name: "A1" },
      { shopId: "b", type: "FREE_FEES", discountValue: 0, name: "B1" },
      { shopId: "a", type: "AMOUNT", discountValue: 3, name: "A2" },
    ]);

    expect([...labels]).toEqual([
      ["a", "-20%"],
      ["b", "Frais offerts"],
    ]);
  });

  it("gives no label without offers", () => {
    expect(badgeLabelsByShop([]).size).toBe(0);
  });
});
