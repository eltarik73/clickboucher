// src/lib/services/orders/commands/unavailable-lines.ts — the lines of an order with out-of-stock
// items, as unavailable.ts reads them, and the order columns that follow from the lines the customer
// still gets once he or the butcher changes its composition.
import type { OrderItem, Prisma } from "@prisma/client";
import { estimatedTotalOf, type EstimatedLine } from "@/lib/pricing/tolerance";
import { computeOrderTotals } from "@/lib/pricing/totals";

type Tx = Prisma.TransactionClient;

export const ITEM_SNAPSHOT_SELECT = {
  id: true,
  productId: true,
  available: true,
  totalCents: true,
  estimatedPriceCents: true,
  replacement: true,
  unit: true,
  quantity: true,
  weightGrams: true,
  name: true,
} satisfies Prisma.OrderItemSelect;

type LineSnapshot = Pick<
  OrderItem,
  "id" | "productId" | "available" | "totalCents" | "estimatedPriceCents" | "replacement"
>;

/** The lines a decision was taken on are still the order's lines (read under its lock). */
export function sameLines(
  expected: readonly LineSnapshot[],
  actual: readonly LineSnapshot[]
): boolean {
  const key = (line: LineSnapshot) =>
    [
      line.id,
      line.productId,
      line.available,
      line.totalCents,
      line.estimatedPriceCents ?? "",
      line.replacement ?? "",
    ].join("|");
  const expectedKeys = expected.map(key).sort();
  const actualKeys = actual.map(key).sort();
  return (
    expectedKeys.length === actualKeys.length && expectedKeys.every((k, i) => k === actualKeys[i])
  );
}

export async function readLines(tx: Tx, orderId: string) {
  return tx.orderItem.findMany({ where: { orderId }, select: ITEM_SNAPSHOT_SELECT });
}

/**
 * The order columns that follow its composition, from the lines the customer still gets:
 * Order.totalCents (their totals minus the stored discount) and, on an order with a frozen weighing
 * tolerance, the estimated total it applies to, frozen again on those lines (estimatedTotalOf)
 * while the rate and the cap stay as the customer chose them. A weighing increase already applied
 * stays counted: a line's estimate is not its weighed total.
 */
export function compositionColumns(
  kept: readonly EstimatedLine[],
  order: { discountCents: number; serviceFeeCents: number; estimatedTotalCents: number | null }
): { totalCents: number; estimatedTotalCents?: number | null } {
  const { totalCents } = computeOrderTotals({
    lineTotalsCents: kept.map((line) => line.totalCents),
    discountCents: order.discountCents,
    serviceFeeCents: order.serviceFeeCents,
  });
  if (order.estimatedTotalCents === null) return { totalCents };
  return {
    totalCents,
    estimatedTotalCents: estimatedTotalOf(kept, order.discountCents),
  };
}
