// src/lib/order-number-format.ts — text form of the three numbers of an order.
// Pure and client-safe: the numbers themselves are allocated by the database
// (src/lib/services/orders/numbering.ts); this module only formats them.

const ORDER_SEQUENCE_DIGITS = 6;
const DISPLAY_NUMBER_DIGITS = 3;
const CUSTOMER_NUMBER_DIGITS = 3;

function assertCounterValue(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, received ${value}`);
  }
}

/**
 * Order number: "KG" + 2-digit Paris year + "-" + sequence on at least 6 digits.
 * (2026, 166) => "KG26-000166".
 *
 * The format is deliberately disjoint from the legacy "KG-2026-00166": the
 * previous code allocates max+1 among numbers starting with "KG-<year>-" and
 * may run next to this one during a deploy or after a rollback. With two
 * prefixes that never overlap, the two allocators cannot collide on the
 * unique index of orders.order_number.
 */
export function formatOrderNumber(parisYear: number, sequence: number): string {
  assertCounterValue("parisYear", parisYear);
  assertCounterValue("sequence", sequence);
  const year = String(parisYear % 100).padStart(2, "0");
  return `KG${year}-${String(sequence).padStart(ORDER_SEQUENCE_DIGITS, "0")}`;
}

/** Ticket number of the day, per shop: 12 => "#012". */
export function formatDisplayNumber(dailyNumber: number): string {
  assertCounterValue("dailyNumber", dailyNumber);
  return `#${String(dailyNumber).padStart(DISPLAY_NUMBER_DIGITS, "0")}`;
}

/**
 * Customer number of a (shop, customer) pair, as stored on the order: 12 => "C-012".
 * null when the order carries no number (orders created before the per-shop numbering).
 */
export function formatCustomerNumber(customerNumber: number | null | undefined): string | null {
  if (customerNumber === null || customerNumber === undefined) return null;
  assertCounterValue("customerNumber", customerNumber);
  return `C-${String(customerNumber).padStart(CUSTOMER_NUMBER_DIGITS, "0")}`;
}
