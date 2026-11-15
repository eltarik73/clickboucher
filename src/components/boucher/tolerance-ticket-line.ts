// src/components/boucher/tolerance-ticket-line.ts — the line of the kitchen ticket that states the
// weighing tolerance the customer accepted, frozen on his order: within it the butcher applies a
// new weighed price without asking him. The line is plain text; the ticket escapes it.
import { formatPriceCents } from "@/lib/format-kitchen";
import {
  formatToleranceTerms,
  frozenAllowanceCents,
  frozenToleranceOf,
  type FrozenToleranceColumns,
} from "@/lib/pricing/tolerance";

/**
 * "Marge de pesée acceptée : 5 % du total estimé, 10,00 € au plus (jusqu'à 1,22 €)", or null for
 * an order without a frozen tolerance (every increase needs the customer's yes).
 */
export function toleranceTicketLine(order: FrozenToleranceColumns): string | null {
  const tolerance = frozenToleranceOf(order);
  if (tolerance === null) return null;
  const allowed = formatPriceCents(frozenAllowanceCents(tolerance));
  return `Marge de pesée acceptée : ${formatToleranceTerms(tolerance)} (jusqu'à ${allowed})`;
}
