// @vitest-environment node
// planMarkupReprice (src/lib/services/shops/markup-reprice.ts): the product writes after a shop
// changes its markup or rounding, anti-gaspi included (review of PR #28: the reprice ignored it).
import { describe, expect, it } from "vitest";
import { antiGaspiEndedColumns } from "@/lib/pricing/anti-gaspi";
import { planMarkupReprice, type RepricedProduct } from "@/lib/services/shops/markup-reprice";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const YESTERDAY = new Date("2026-11-14T12:00:00.000Z");
const TOMORROW = new Date("2026-11-16T12:00:00.000Z");
const double = (boutiquePriceCents: number) => boutiquePriceCents * 2;

function product(overrides: Partial<RepricedProduct> = {}): RepricedProduct {
  return { id: "p1", boutiquePriceCents: 1000, priceCents: 1200, isAntiGaspi: false, ...overrides };
}

describe("planMarkupReprice", () => {
  it("gives an ordinary product its new online price", () => {
    expect(planMarkupReprice([product()], double, NOW)).toEqual([
      { id: "p1", data: { priceCents: 2000 } },
    ]);
  });

  it("leaves out a product already at its price, and one without boutique price", () => {
    const products = [
      product({ priceCents: 2000 }),
      product({ id: "p2", boutiquePriceCents: null }),
      product({ id: "p3", boutiquePriceCents: 0 }),
    ];

    expect(planMarkupReprice(products, double, NOW)).toEqual([]);
  });

  it("keeps a running anti-gaspi price and moves the price it returns to", () => {
    const running = product({
      priceCents: 600,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 1200,
      antiGaspiEndAt: TOMORROW,
    });

    expect(planMarkupReprice([running], double, NOW)).toEqual([
      { id: "p1", data: { antiGaspiOrigPriceCents: 2000 } },
    ]);
    expect(planMarkupReprice([{ ...running, antiGaspiOrigPriceCents: 2000 }], double, NOW)).toEqual(
      []
    );
  });

  it("ends an expired anti-gaspi in the same write as the new price", () => {
    const expired = product({
      priceCents: 600,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 1200,
      antiGaspiEndAt: YESTERDAY,
      antiGaspiStock: 0,
    });

    expect(planMarkupReprice([expired], double, NOW)).toEqual([
      { id: "p1", data: { priceCents: 2000, ...antiGaspiEndedColumns } },
    ]);
  });

  it("ends an expired anti-gaspi even when its discounted price equals the new price", () => {
    const expired = product({
      priceCents: 2000,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 2400,
      antiGaspiEndAt: YESTERDAY,
    });

    expect(planMarkupReprice([expired], double, NOW)).toEqual([
      { id: "p1", data: { priceCents: 2000, ...antiGaspiEndedColumns } },
    ]);
  });

  it("treats an anti-gaspi without end date as running", () => {
    const open = product({
      priceCents: 600,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 1200,
      antiGaspiEndAt: null,
    });

    expect(planMarkupReprice([open], double, NOW)).toEqual([
      { id: "p1", data: { antiGaspiOrigPriceCents: 2000 } },
    ]);
  });
});
