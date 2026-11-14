// src/lib/services/orders/adjustment-settlement.ts — the only place where a price adjustment changes
// an order, and where a pending adjustment ends.
//
// A pending adjustment stores the total it was computed against (originalTotal), the new total and
// the line changes. It is applied by ONE function, settleAdjustmentInTx, whichever way it is
// settled: tier 1 at creation, the customer's acceptance, the tier-2 deadline. In one transaction:
//   1. the order row is locked (scoped to the caller) — every writer of an order takes this lock
//      first (transition.ts), so lines and total cannot change until the commit;
//   2. a conditional update PENDING -> settled status: the request that changes the row wins, any
//      concurrent one finds nothing pending and does nothing (one notification, sent by the winner
//      after the commit);
//   3. the order must still be what the adjustment was computed against (adjustable status, same
//      total, same available lines); otherwise the adjustment is closed unapplied (REJECTED);
//   4. conditional writes of the total and of the lines.
// Every transition that changes the lines or closes the order closes a pending adjustment in its own
// transaction (closePendingAdjustment). The deadline and the customer's answers: adjustment-answers.ts.
import { Prisma, type Order, type OrderStatus, type PriceAdjustment } from "@prisma/client";
import { z } from "zod";

import { logger } from "@/lib/logger";

type Tx = Prisma.TransactionClient;

/** Statuses in which the butcher may propose an adjustment. */
export const ADJUSTMENT_CREATION_STATUSES: readonly OrderStatus[] = ["ACCEPTED", "PREPARING"];
/** Statuses in which a pending adjustment may still be applied: the goods are not handed over yet. */
export const ADJUSTMENT_SETTLEMENT_STATUSES: readonly OrderStatus[] = [
  "ACCEPTED",
  "PREPARING",
  "READY",
];

/** How an applied adjustment was settled. */
export type SettledStatus = "AUTO_APPROVED" | "APPROVED" | "AUTO_VALIDATED";

/** Status of an adjustment that ended without being applied (refused, or the order changed under it). */
export const UNAPPLIED_STATUS = "REJECTED";

export type AdjustmentScope = { shopId: string } | { userId: string } | { system: true };

/** One line change of an adjustment, as stored in PriceAdjustment.itemsSnapshot. */
const snapshotLineSchema = z
  .object({
    orderItemId: z.string().min(1),
    oldTotalCents: z.number().int().min(0),
    newTotalCents: z.number().int().min(0),
    newQuantity: z.number().min(0).optional(),
    newPriceCents: z.number().int().min(0).optional(),
  })
  .passthrough();

export type AdjustmentSnapshotLine = z.infer<typeof snapshotLineSchema>;

const snapshotSchema = z.array(snapshotLineSchema).nullable();

export interface LockedOrder {
  id: string;
  shopId: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
}

/** SELECT … FOR UPDATE of the order within the caller's scope; null when outside it. */
export async function lockOrderForAdjustment(
  tx: Tx,
  orderId: string,
  scope: AdjustmentScope
): Promise<LockedOrder | null> {
  const scopeSql =
    "shopId" in scope
      ? Prisma.sql`AND "shop_id" = ${scope.shopId}`
      : "userId" in scope
        ? Prisma.sql`AND "user_id" = ${scope.userId}`
        : Prisma.empty;
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      shop_id: string;
      user_id: string;
      status: OrderStatus;
      total_cents: number;
    }>
  >`SELECT "id", "shop_id", "user_id", "status", "total_cents" FROM "orders" WHERE "id" = ${orderId} ${scopeSql} FOR UPDATE`;
  const row = rows[0];
  return row === undefined
    ? null
    : {
        id: row.id,
        shopId: row.shop_id,
        userId: row.user_id,
        status: row.status,
        totalCents: row.total_cents,
      };
}

/**
 * Closes the order's pending adjustment unapplied. Called in the transaction of every transition
 * that changes the lines or ends the order: an adjustment computed against the old content must
 * never be applied to the new one.
 */
export async function closePendingAdjustment(tx: Tx, orderId: string, now: Date): Promise<void> {
  await tx.priceAdjustment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: UNAPPLIED_STATUS, respondedAt: now },
  });
}

export type SettleOutcome =
  | { kind: "settled"; adjustment: PriceAdjustment; order: Order }
  /** No pending adjustment matched: none, already settled or refused, or not due yet. */
  | { kind: "not_pending" }
  /** The order changed since the adjustment was computed: closed unapplied. */
  | { kind: "order_changed" }
  | { kind: "not_found" };

async function closeUnapplied(
  tx: Tx,
  adjustment: PriceAdjustment,
  now: Date
): Promise<SettleOutcome> {
  await tx.priceAdjustment.update({
    where: { id: adjustment.id },
    data: { status: UNAPPLIED_STATUS, respondedAt: now },
  });
  return { kind: "order_changed" };
}

/** Line changes of a stored adjustment; null when the snapshot is not one this module wrote. */
function snapshotLines(adjustment: PriceAdjustment): AdjustmentSnapshotLine[] | null {
  const parsed = snapshotSchema.safeParse(adjustment.itemsSnapshot);
  if (!parsed.success) {
    logger.error("[price-adjustment] Unreadable items snapshot, adjustment closed", {
      adjustmentId: adjustment.id,
      issues: parsed.error.issues,
    });
    return null;
  }
  return parsed.data ?? [];
}

/** Applies the pending adjustment of the order on the caller's transaction (see the file header). */
export async function settleAdjustmentInTx(
  tx: Tx,
  input: {
    orderId: string;
    scope: AdjustmentScope;
    settledAs: SettledStatus;
    now: Date;
    /** Extra conditions on the adjustment (tier, deadline passed). */
    due?: Prisma.PriceAdjustmentWhereInput;
  }
): Promise<SettleOutcome> {
  const order = await lockOrderForAdjustment(tx, input.orderId, input.scope);
  if (order === null) return { kind: "not_found" };

  const { count } = await tx.priceAdjustment.updateMany({
    where: { AND: [{ orderId: order.id, status: "PENDING" }, input.due ?? {}] },
    data: { status: input.settledAs, respondedAt: input.now },
  });
  if (count === 0) return { kind: "not_pending" };
  const adjustment = await tx.priceAdjustment.findUniqueOrThrow({ where: { orderId: order.id } });

  const lines = snapshotLines(adjustment);
  if (
    lines === null ||
    adjustment.shopId !== order.shopId ||
    !ADJUSTMENT_SETTLEMENT_STATUSES.includes(order.status) ||
    order.totalCents !== adjustment.originalTotal
  ) {
    return closeUnapplied(tx, adjustment, input.now);
  }
  const current = await tx.orderItem.findMany({
    where: { orderId: order.id, id: { in: lines.map((line) => line.orderItemId) } },
    select: { id: true, available: true, totalCents: true },
  });
  const currentById = new Map(current.map((item) => [item.id, item]));
  const unchanged = lines.every((line) => {
    const item = currentById.get(line.orderItemId);
    return item !== undefined && item.available && item.totalCents === line.oldTotalCents;
  });
  if (!unchanged) return closeUnapplied(tx, adjustment, input.now);

  const written = await tx.order.updateMany({
    where: {
      id: order.id,
      shopId: adjustment.shopId,
      status: { in: [...ADJUSTMENT_SETTLEMENT_STATUSES] },
      totalCents: adjustment.originalTotal,
    },
    data: { totalCents: adjustment.newTotal },
  });
  if (written.count !== 1)
    throw new Error(`Adjustment of order ${order.id} matched ${written.count} rows under lock`);
  for (const line of lines) {
    const item = await tx.orderItem.updateMany({
      where: {
        id: line.orderItemId,
        orderId: order.id,
        available: true,
        totalCents: line.oldTotalCents,
      },
      data: {
        totalCents: line.newTotalCents,
        ...(line.newQuantity !== undefined && { quantity: line.newQuantity }),
        ...(line.newPriceCents !== undefined && { priceCents: line.newPriceCents }),
      },
    });
    if (item.count !== 1)
      throw new Error(`Adjustment line ${line.orderItemId} matched ${item.count} rows under lock`);
  }
  return {
    kind: "settled",
    adjustment,
    order: await tx.order.findUniqueOrThrow({ where: { id: order.id } }),
  };
}
