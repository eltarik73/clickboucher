// src/lib/pricing/totals.ts — the totals of an order.
//
//   subtotalCents   = sum of the line totals (goods)
//   discountCents   = discount on the goods, at most the subtotal
//   totalCents      = subtotal - discount = Order.totalCents: the goods amount the butcher
//                     collects, base of the commission, the adjustments and the statistics
//   serviceFeeCents = fee charged to the customer for this order = Order.serviceFeeCents,
//                     stored beside the total, never inside it
//   amountDueCents  = totalCents + serviceFeeCents: the « Total à payer » of the cart
//
// Pure and client-safe.

import { SERVICE_FEE_CENTS } from "@/lib/services/stripe/commission";
import { assertCents } from "./line";

export type PaymentMethod = "ON_PICKUP" | "ONLINE";

/**
 * Service fee charged to the customer, by payment method — the one place the policy lives.
 * ON_PICKUP => 0: nobody collects a fee at the counter, so none is announced or stored.
 * ONLINE => SERVICE_FEE_CENTS.
 * Throws RangeError on a payment method this policy does not know.
 */
export function serviceFeeCentsFor(paymentMethod: PaymentMethod): number {
  switch (paymentMethod) {
    case "ON_PICKUP":
      return 0;
    case "ONLINE":
      return SERVICE_FEE_CENTS;
    default: {
      const unknownMethod: never = paymentMethod;
      throw new RangeError(`No service fee policy for payment method ${String(unknownMethod)}`);
    }
  }
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  serviceFeeCents: number;
  amountDueCents: number;
}

/**
 * Totals of an order from its line totals, the discount granted on the goods and the service fee
 * actually charged (0 when waived). The discount is capped at the subtotal: it never reaches the
 * service fee. Throws RangeError on a negative or non-integer input.
 */
export function computeOrderTotals(input: {
  lineTotalsCents: readonly number[];
  discountCents: number;
  serviceFeeCents: number;
}): OrderTotals {
  input.lineTotalsCents.forEach((cents, index) => assertCents(`lineTotalsCents[${index}]`, cents));
  assertCents("discountCents", input.discountCents);
  assertCents("serviceFeeCents", input.serviceFeeCents);

  const subtotalCents = input.lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
  assertCents("subtotalCents", subtotalCents);
  const discountCents = Math.min(input.discountCents, subtotalCents);
  const totalCents = subtotalCents - discountCents;

  return {
    subtotalCents,
    discountCents,
    totalCents,
    serviceFeeCents: input.serviceFeeCents,
    amountDueCents: totalCents + input.serviceFeeCents,
  };
}
