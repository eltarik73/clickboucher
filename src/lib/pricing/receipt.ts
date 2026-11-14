// src/lib/pricing/receipt.ts — what a receipt or a ticket says an order costs.
//
// The amount charged is the order's own total (Order.totalCents, plus the service fee of an order
// paid online), never a sum recomputed from the lines: lines go out of stock, a promo code or a
// loyalty reward takes an amount off, the butcher adjusts a total. The receipt lists the available
// lines, their subtotal, the discount and the remaining difference (a manual adjustment); the goods
// total is split by VAT rate in proportion to the sold lines of each rate.
//
// Pure and client-safe: no database, no clock, no I/O. Amounts are integer cents.
import { assertCents } from "./line";

export interface ReceiptLine {
  totalCents: number;
  /** false: out of stock or removed; not sold, not charged. */
  available: boolean;
}

export interface VatLine {
  totalCents: number;
  /** VAT rate of the line in percent (product rate or shop default). */
  vatRate: number;
}

export interface ReceiptOrder<L extends ReceiptLine> {
  lines: readonly L[];
  /** Order.totalCents: goods charged, after discount and adjustments. */
  totalCents: number;
  /** Order.discountCents: discount on goods recorded at creation. */
  discountCents: number;
  /** Order.serviceFeeCents. Charged only when the order is paid online. */
  serviceFeeCents: number;
  paymentMethod: string;
}

export interface VatGroup {
  rate: number;
  ttcCents: number;
  htCents: number;
  vatCents: number;
}

export interface ReceiptSummary<L extends ReceiptLine> {
  /** Lines sold, in order. */
  lines: L[];
  /** Lines not sold (out of stock, removed), in order. */
  unavailableLines: L[];
  subtotalCents: number;
  /** Discount on goods, at most the subtotal. */
  discountCents: number;
  /** totalCents - (subtotal - discount): a total changed after the order was placed (adjustment). */
  adjustmentCents: number;
  /** = Order.totalCents. */
  goodsTotalCents: number;
  serviceFeeCents: number;
  /** goodsTotalCents + serviceFeeCents: what the customer pays. */
  amountChargedCents: number;
}

/**
 * Splits `totalCents` between the rates in proportion to `weights` (largest remainder: the parts
 * add up exactly to the total).
 */
function prorate(
  totalCents: number,
  weights: ReadonlyArray<{ rate: number; cents: number }>
): Map<number, number> {
  const weightSum = weights.reduce((sum, weight) => sum + weight.cents, 0);
  const parts = weights.map((weight) => {
    const exact = (totalCents * weight.cents) / weightSum;
    return { rate: weight.rate, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = totalCents - parts.reduce((sum, part) => sum + part.cents, 0);
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || b.rate - a.rate)) {
    if (left === 0) break;
    part.cents += 1;
    left -= 1;
  }
  return new Map(parts.map((part) => [part.rate, part.cents]));
}

/**
 * `goodsTotalCents` split by VAT rate in proportion to the sold lines of each rate (so a discount or
 * an adjustment is prorated), highest rate first; the groups add up exactly to goodsTotalCents.
 * Throws RangeError on a positive total with no sold amount to attribute its VAT to.
 */
export function vatBreakdown(soldLines: readonly VatLine[], goodsTotalCents: number): VatGroup[] {
  assertCents("goodsTotalCents", goodsTotalCents);
  const centsByRate = new Map<number, number>();
  for (const line of soldLines) {
    assertCents("line totalCents", line.totalCents);
    centsByRate.set(line.vatRate, (centsByRate.get(line.vatRate) ?? 0) + line.totalCents);
  }
  const weights = [...centsByRate]
    .map(([rate, cents]) => ({ rate, cents }))
    .sort((a, b) => b.rate - a.rate);
  const soldCents = weights.reduce((sum, weight) => sum + weight.cents, 0);
  if (soldCents === 0 && goodsTotalCents > 0) {
    throw new RangeError(
      `A goods total of ${goodsTotalCents} cents has no sold line to attribute its VAT to`
    );
  }
  const ttcByRate = soldCents === 0 ? new Map<number, number>() : prorate(goodsTotalCents, weights);
  return weights.map(({ rate }) => {
    const ttcCents = ttcByRate.get(rate) ?? 0;
    const htCents = Math.round((ttcCents * 100) / (100 + rate));
    return { rate, ttcCents, htCents, vatCents: ttcCents - htCents };
  });
}

/** Throws RangeError on an amount that is not whole cents. */
export function summarizeReceipt<L extends ReceiptLine>(order: ReceiptOrder<L>): ReceiptSummary<L> {
  assertCents("totalCents", order.totalCents);
  assertCents("discountCents", order.discountCents);
  assertCents("serviceFeeCents", order.serviceFeeCents);
  const lines = order.lines.filter((line) => line.available);
  for (const line of lines) assertCents("line totalCents", line.totalCents);

  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const discountCents = Math.min(order.discountCents, subtotalCents);
  const serviceFeeCents = order.paymentMethod === "ONLINE" ? order.serviceFeeCents : 0;
  return {
    lines,
    unavailableLines: order.lines.filter((line) => !line.available),
    subtotalCents,
    discountCents,
    adjustmentCents: order.totalCents - (subtotalCents - discountCents),
    goodsTotalCents: order.totalCents,
    serviceFeeCents,
    amountChargedCents: order.totalCents + serviceFeeCents,
  };
}
