// src/components/boucher/tolerance-ticket-line.ts — the weighing tolerance the customer accepted,
// frozen on his order at creation, as the kitchen reads it: within it the butcher applies a new
// weighed price without asking him. The ticket line is plain text; the ticket escapes it.
import { formatPriceCents } from "@/lib/format-kitchen";
import {
  formatToleranceTerms,
  frozenToleranceOf,
  toleranceCents,
  type FrozenTolerance,
} from "@/lib/pricing/tolerance";

/** The frozen tolerance columns of a kitchen order; absent or null on orders created before it. */
export interface ToleranceColumns {
  weighToleranceRateBps?: number | null;
  weighToleranceCapCents?: number | null;
  estimatedTotalCents?: number | null;
}

/** The tolerance frozen on a kitchen order, or null (every increase needs the customer's yes). */
export function kitchenOrderTolerance(order: ToleranceColumns): FrozenTolerance | null {
  return frozenToleranceOf({
    weighToleranceRateBps: order.weighToleranceRateBps ?? null,
    weighToleranceCapCents: order.weighToleranceCapCents ?? null,
    estimatedTotalCents: order.estimatedTotalCents ?? null,
  });
}

/**
 * "Marge de pesée acceptée : 5 % du total estimé, 10,00 € au plus (jusqu'à 1,22 €)", or null for
 * an order without a frozen tolerance.
 */
export function toleranceTicketLine(order: ToleranceColumns): string | null {
  const tolerance = kitchenOrderTolerance(order);
  if (tolerance === null) return null;
  const allowed = formatPriceCents(toleranceCents(tolerance, tolerance.estimatedTotalCents));
  return `Marge de pesée acceptée : ${formatToleranceTerms(tolerance)} (jusqu'à ${allowed})`;
}
