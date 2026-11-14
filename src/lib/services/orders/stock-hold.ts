// src/lib/services/orders/stock-hold.ts — the limited stock an order holds.
//
// The units reserved at acceptance are written into the ACCEPTED OrderEvent and the release gives
// back exactly those units. Recomputing them from the order lines at release time would be wrong
// after a butcher's weight adjustment: the adjusted line no longer splits into its portions and
// would give back 1 unit instead of the number of portions taken.
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { releaseLimitedStock, stockLinesFromItems, type StockLine } from "./limited-stock";

type Tx = Prisma.TransactionClient;

export const ACCEPTED_EVENT_TYPE = "ACCEPTED";

const STOCK_LINE_SELECT = {
  productId: true,
  unit: true,
  quantity: true,
  weightGrams: true,
  available: true,
} satisfies Prisma.OrderItemSelect;

const acceptedPayloadSchema = z.object({
  stockUnits: z.array(
    z.object({ productId: z.string().min(1), units: z.number().int().positive() })
  ),
});

/**
 * Payload fields of the ACCEPTED event that record the units reserved. Every writer of an ACCEPTED
 * event that reserves stock (the accept command, and order creation in an auto-accept shop) uses it.
 */
export function stockUnitsPayload(lines: readonly StockLine[]): {
  stockUnits: Prisma.InputJsonObject[];
} {
  return { stockUnits: lines.map((line) => ({ productId: line.productId, units: line.units })) };
}

/** Units of the order's available lines, read in the caller's transaction. */
export async function stockLinesOfOrder(tx: Tx, orderId: string): Promise<StockLine[]> {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: STOCK_LINE_SELECT });
  return stockLinesFromItems(items);
}

/**
 * Gives back the units taken by the order's latest acceptance. An acceptance recorded by the code
 * before chantier 0 carries no `stockUnits`: its units are then recomputed from the lines, the only
 * information that exists for it.
 */
export async function releaseHeldStock(
  tx: Tx,
  order: { id: string; shopId: string }
): Promise<void> {
  const accepted = await tx.orderEvent.findFirst({
    where: { orderId: order.id, type: ACCEPTED_EVENT_TYPE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { payloadJson: true },
  });
  const recorded = acceptedPayloadSchema.safeParse(accepted?.payloadJson);
  const lines = recorded.success ? recorded.data.stockUnits : await stockLinesOfOrder(tx, order.id);
  await releaseLimitedStock(tx, order.shopId, lines);
}
