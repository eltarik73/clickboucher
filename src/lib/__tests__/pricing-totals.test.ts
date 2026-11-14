// @vitest-environment node
//
// Order totals. Order.totalCents is the goods amount the butcher collects
// (subtotal - discount); the service fee is stored beside it and added only in
// the amount the customer pays. Nobody collects a fee on pay-on-pickup orders,
// so the cart must not announce one.

import { describe, it, expect } from "vitest";
import { SERVICE_FEE_CENTS } from "@/lib/services/stripe/commission";
import {
  computeOrderTotals,
  serviceFeeCentsFor,
  type OrderTotals,
  type PaymentMethod,
} from "@/lib/pricing/totals";

describe("serviceFeeCentsFor", () => {
  it.each<[PaymentMethod, number]>([
    ["ON_PICKUP", 0],
    ["ONLINE", 99],
  ])("%s => %d cents", (paymentMethod, expected) => {
    expect(serviceFeeCentsFor(paymentMethod)).toBe(expected);
  });

  it("should charge online orders the platform fee constant", () => {
    expect(serviceFeeCentsFor("ONLINE")).toBe(SERVICE_FEE_CENTS);
  });

  it("should throw RangeError on an unknown payment method instead of charging nothing", () => {
    expect(() => serviceFeeCentsFor("CASH" as PaymentMethod)).toThrow(RangeError);
    expect(() => serviceFeeCentsFor(undefined as unknown as PaymentMethod)).toThrow(RangeError);
  });
});

describe("computeOrderTotals", () => {
  type Input = Parameters<typeof computeOrderTotals>[0];

  it.each<[string, Input, OrderTotals]>([
    [
      "one line, no discount, pay on pickup",
      { lineTotalsCents: [956], discountCents: 0, serviceFeeCents: 0 },
      {
        subtotalCents: 956,
        discountCents: 0,
        totalCents: 956,
        serviceFeeCents: 0,
        amountDueCents: 956,
      },
    ],
    [
      "several lines",
      { lineTotalsCents: [956, 1722, 748], discountCents: 0, serviceFeeCents: 0 },
      {
        subtotalCents: 3426,
        discountCents: 0,
        totalCents: 3426,
        serviceFeeCents: 0,
        amountDueCents: 3426,
      },
    ],
    [
      "a discount on the goods",
      { lineTotalsCents: [956, 1222], discountCents: 218, serviceFeeCents: 0 },
      {
        subtotalCents: 2178,
        discountCents: 218,
        totalCents: 1960,
        serviceFeeCents: 0,
        amountDueCents: 1960,
      },
    ],
    [
      "a discount larger than the subtotal is capped at it",
      { lineTotalsCents: [300], discountCents: 500, serviceFeeCents: 0 },
      {
        subtotalCents: 300,
        discountCents: 300,
        totalCents: 0,
        serviceFeeCents: 0,
        amountDueCents: 0,
      },
    ],
    [
      "the service fee is due on top of the goods and is not part of the total",
      { lineTotalsCents: [956, 1222], discountCents: 0, serviceFeeCents: 99 },
      {
        subtotalCents: 2178,
        discountCents: 0,
        totalCents: 2178,
        serviceFeeCents: 99,
        amountDueCents: 2277,
      },
    ],
    [
      "a discount never eats the service fee",
      { lineTotalsCents: [300], discountCents: 500, serviceFeeCents: 99 },
      {
        subtotalCents: 300,
        discountCents: 300,
        totalCents: 0,
        serviceFeeCents: 99,
        amountDueCents: 99,
      },
    ],
    [
      "a discount and a fee together",
      { lineTotalsCents: [956, 1222], discountCents: 218, serviceFeeCents: 99 },
      {
        subtotalCents: 2178,
        discountCents: 218,
        totalCents: 1960,
        serviceFeeCents: 99,
        amountDueCents: 2059,
      },
    ],
    [
      "free lines",
      { lineTotalsCents: [0, 0], discountCents: 0, serviceFeeCents: 0 },
      { subtotalCents: 0, discountCents: 0, totalCents: 0, serviceFeeCents: 0, amountDueCents: 0 },
    ],
    [
      "no line",
      { lineTotalsCents: [], discountCents: 0, serviceFeeCents: 0 },
      { subtotalCents: 0, discountCents: 0, totalCents: 0, serviceFeeCents: 0, amountDueCents: 0 },
    ],
  ])("%s", (_label, input, expected) => {
    expect(computeOrderTotals(input)).toStrictEqual(expected);
  });

  it("should always satisfy total = subtotal - discount and amountDue = total + fee", () => {
    for (const lineTotalsCents of [[0], [1], [956], [956, 1722], [3822, 1912, 1998, 748]]) {
      for (const discountCents of [0, 1, 218, 956, 10_000]) {
        for (const serviceFeeCents of [0, 99]) {
          const totals = computeOrderTotals({ lineTotalsCents, discountCents, serviceFeeCents });
          const sum = lineTotalsCents.reduce((total, cents) => total + cents, 0);

          expect(totals.subtotalCents).toBe(sum);
          expect(totals.discountCents).toBe(Math.min(discountCents, sum));
          expect(totals.totalCents).toBe(totals.subtotalCents - totals.discountCents);
          expect(totals.totalCents).toBeGreaterThanOrEqual(0);
          expect(totals.serviceFeeCents).toBe(serviceFeeCents);
          expect(totals.amountDueCents).toBe(totals.totalCents + totals.serviceFeeCents);
        }
      }
    }
  });

  it.each<[string, Input]>([
    ["a negative line total", { lineTotalsCents: [956, -1], discountCents: 0, serviceFeeCents: 0 }],
    ["a fractional line total", { lineTotalsCents: [955.5], discountCents: 0, serviceFeeCents: 0 }],
    ["a NaN line total", { lineTotalsCents: [Number.NaN], discountCents: 0, serviceFeeCents: 0 }],
    ["a negative discount", { lineTotalsCents: [956], discountCents: -1, serviceFeeCents: 0 }],
    ["a fractional discount", { lineTotalsCents: [956], discountCents: 95.6, serviceFeeCents: 0 }],
    ["a negative service fee", { lineTotalsCents: [956], discountCents: 0, serviceFeeCents: -99 }],
    [
      "a fractional service fee",
      { lineTotalsCents: [956], discountCents: 0, serviceFeeCents: 0.99 },
    ],
  ])("should throw RangeError on %s", (_label, input) => {
    expect(() => computeOrderTotals(input)).toThrow(RangeError);
  });
});
