// @vitest-environment node
// Item 4 (C1-URGENCES): an anti-gaspi discount stops at its end date. The butcher's action stores
// the discounted price in Product.priceCents and the original in antiGaspiOrigPriceCents; nothing
// writes the original back at antiGaspiEndAt, so every reader must apply the end date itself.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { antiGaspiExpired, publicPriceCents, settleAntiGaspi } from "@/lib/pricing/anti-gaspi";
import { limitedStockRemaining } from "@/lib/pricing/limited-stock";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";

const NOW = new Date("2026-11-15T10:00:00.000Z");
const ONE_HOUR_AGO = new Date("2026-11-15T09:00:00.000Z");
const IN_ONE_HOUR = new Date("2026-11-15T11:00:00.000Z");

/** Put in anti-gaspi as POST /api/boucher/anti-gaspi does: 2000 -> 1000 (-50 %). */
function antiGaspi(antiGaspiEndAt: Date | string | null) {
  return {
    id: "prod-1",
    name: "Merguez",
    priceCents: 1000,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: 2000,
    antiGaspiEndAt,
    antiGaspiStock: 4,
    antiGaspiReason: "DLC proche",
  };
}

describe("antiGaspiExpired", () => {
  it.each([
    ["end one hour ago", true, antiGaspi(ONE_HOUR_AGO)],
    ["end exactly now", true, antiGaspi(NOW)],
    ["end one millisecond later", false, antiGaspi(new Date(NOW.getTime() + 1))],
    ["end in one hour", false, antiGaspi(IN_ONE_HOUR)],
    ["no end date", false, antiGaspi(null)],
    ["end ISO string in the past", true, antiGaspi("2026-11-15T09:00:00.000Z")],
    ["end ISO string in the future", false, antiGaspi("2026-11-15T11:00:00.000Z")],
    ["mode off with a past end", false, { ...antiGaspi(ONE_HOUR_AGO), isAntiGaspi: false }],
    ["mode null with a past end", false, { ...antiGaspi(ONE_HOUR_AGO), isAntiGaspi: null }],
    ["end undefined", false, { isAntiGaspi: true }],
  ])("%s -> %s", (_label, expected, product) => {
    expect(antiGaspiExpired(product, NOW)).toBe(expected);
  });

  it("throws TypeError on an end date that is not a date, as the promotion end does", () => {
    expect(() => antiGaspiExpired(antiGaspi("pas une date"), NOW)).toThrow(TypeError);
  });
});

describe("publicPriceCents", () => {
  it("is the original price once the end date has passed", () => {
    expect(publicPriceCents(antiGaspi(ONE_HOUR_AGO), NOW)).toBe(2000);
  });

  it("is the original price at the end instant itself", () => {
    expect(publicPriceCents(antiGaspi(NOW), NOW)).toBe(2000);
  });

  it.each([
    ["future end", antiGaspi(IN_ONE_HOUR)],
    ["no end date", antiGaspi(null)],
    ["mode off", { ...antiGaspi(ONE_HOUR_AGO), isAntiGaspi: false }],
  ])("keeps the stored (discounted) price: %s", (_label, product) => {
    expect(publicPriceCents(product, NOW)).toBe(1000);
  });

  it("keeps priceCents when the expired row has no original price (unknown original)", () => {
    expect(
      publicPriceCents({ ...antiGaspi(ONE_HOUR_AGO), antiGaspiOrigPriceCents: null }, NOW)
    ).toBe(1000);
  });

  it("reads ISO-string dates as the browser receives them", () => {
    expect(publicPriceCents(antiGaspi("2026-11-15T09:59:59.999Z"), NOW)).toBe(2000);
    expect(publicPriceCents(antiGaspi("2026-11-15T10:00:00.001Z"), NOW)).toBe(1000);
  });

  it("refuses an original price that is not whole cents", () => {
    expect(() =>
      publicPriceCents({ ...antiGaspi(ONE_HOUR_AGO), antiGaspiOrigPriceCents: 1999.5 }, NOW)
    ).toThrow(RangeError);
  });
});

describe("settleAntiGaspi", () => {
  it("returns the same object when the discount is still in force", () => {
    const product = antiGaspi(IN_ONE_HOUR);
    expect(settleAntiGaspi(product, NOW)).toBe(product);
  });

  it("returns the same object when there is no end date", () => {
    const product = antiGaspi(null);
    expect(settleAntiGaspi(product, NOW)).toBe(product);
  });

  it("turns an expired product into the plain product at its original price", () => {
    const product = antiGaspi(ONE_HOUR_AGO);
    expect(settleAntiGaspi(product, NOW)).toStrictEqual({
      id: "prod-1",
      name: "Merguez",
      priceCents: 2000,
      isAntiGaspi: false,
      antiGaspiOrigPriceCents: null,
      antiGaspiEndAt: null,
      antiGaspiStock: null,
      antiGaspiReason: null,
    });
  });

  it("never mutates its input", () => {
    const product = antiGaspi(ONE_HOUR_AGO);
    settleAntiGaspi(product, NOW);
    expect(product).toStrictEqual(antiGaspi(ONE_HOUR_AGO));
  });

  it("clears the mode and keeps priceCents when the original price is unknown", () => {
    const product = { ...antiGaspi(ONE_HOUR_AGO), antiGaspiOrigPriceCents: null };
    expect(settleAntiGaspi(product, NOW)).toMatchObject({
      priceCents: 1000,
      isAntiGaspi: false,
      antiGaspiEndAt: null,
      antiGaspiStock: null,
    });
  });

  it("overwrites only the anti-gaspi keys the input carries", () => {
    const selected = {
      priceCents: 1000,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: 2000,
      antiGaspiEndAt: ONE_HOUR_AGO,
    };
    expect(settleAntiGaspi(selected, NOW)).toStrictEqual({
      priceCents: 2000,
      isAntiGaspi: false,
      antiGaspiOrigPriceCents: null,
      antiGaspiEndAt: null,
    });
  });

  it("frees an expired counter at 0: the storefront no longer reads it as sold out", () => {
    const soldOut = { ...antiGaspi(ONE_HOUR_AGO), antiGaspiStock: 0 };
    expect(limitedStockRemaining(soldOut)).toBe(0);
    expect(limitedStockRemaining(settleAntiGaspi(soldOut, NOW))).toBeNull();
  });

  it("keeps an in-force counter at 0 sold out", () => {
    const soldOut = { ...antiGaspi(IN_ONE_HOUR), antiGaspiStock: 0 };
    expect(limitedStockRemaining(settleAntiGaspi(soldOut, NOW))).toBe(0);
  });
});

describe("resolveUnitPrice applies the anti-gaspi end date", () => {
  const PERCENT_10 = { promoType: "PERCENTAGE", promoPct: 10, promoEnd: null };

  it("prices an expired discount at the original price", () => {
    expect(resolveUnitPrice(antiGaspi(ONE_HOUR_AGO), { isPro: false, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 2000,
      baseCents: 2000,
    });
  });

  it("keeps the discounted price while the end date is ahead", () => {
    expect(resolveUnitPrice(antiGaspi(IN_ONE_HOUR), { isPro: false, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 1000,
      baseCents: 1000,
    });
  });

  it("applies the product promotion on the original price once expired", () => {
    // 2000 x 90 % = 1800.
    const product = { ...antiGaspi(ONE_HOUR_AGO), ...PERCENT_10 };
    expect(resolveUnitPrice(product, { isPro: false, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 1800,
      baseCents: 2000,
    });
  });

  it("applies the product promotion on the discounted price while in force", () => {
    // 1000 x 90 % = 900.
    const product = { ...antiGaspi(IN_ONE_HOUR), ...PERCENT_10 };
    expect(resolveUnitPrice(product, { isPro: false, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 900,
      baseCents: 1000,
    });
  });

  it("gives a pro customer the pro price, whatever the anti-gaspi state", () => {
    const product = { ...antiGaspi(ONE_HOUR_AGO), proPriceCents: 1500 };
    expect(resolveUnitPrice(product, { isPro: true, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 1500,
    });
  });

  it("gives a pro customer without pro price the original price once expired", () => {
    expect(resolveUnitPrice(antiGaspi(ONE_HOUR_AGO), { isPro: true, now: NOW })).toMatchObject({
      ok: true,
      unitPriceCents: 2000,
    });
  });

  it.each([
    ["expired", ONE_HOUR_AGO],
    ["in force", IN_ONE_HOUR],
  ])("leaves a cut option at its own price (%s)", (_label, end) => {
    const product = { ...antiGaspi(end), cutOptions: [{ name: "Escalope", priceCents: 2600 }] };
    expect(
      resolveUnitPrice(product, { isPro: false, cutOption: "Escalope", now: NOW })
    ).toMatchObject({ ok: true, unitPriceCents: 2600, baseCents: 2600 });
  });

  it("reads the ISO-string end date the storefront sends to the browser", () => {
    const product = antiGaspi("2026-11-15T09:00:00.000Z");
    expect(resolveUnitPrice(product, { isPro: false, now: NOW })).toMatchObject({
      unitPriceCents: 2000,
    });
  });
});

describe("the shop page projects settled products", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "(client)", "boutique", "[slug]", "page.tsx"),
    "utf8"
  );
  const declaration = page.indexOf("const liveProducts = shop.products.map(");

  it("settles the products once, before any projection", () => {
    expect(declaration).toBeGreaterThan(-1);
    expect(page.slice(declaration)).toMatch(
      /^const liveProducts = shop\.products\.map\(\(p\) => settleAntiGaspi\(p, \w+\)\);/
    );
  });

  it("never reads shop.products after the settled list exists", () => {
    const afterDeclarationLine = page.slice(page.indexOf("\n", declaration));
    expect(afterDeclarationLine).not.toContain("shop.products");
  });
});
