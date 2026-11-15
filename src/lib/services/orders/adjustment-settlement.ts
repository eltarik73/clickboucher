// src/lib/services/orders/adjustment-settlement.ts — the only place where a price adjustment changes
// an order.
//
// A pending adjustment stores the total it was computed against (originalTotal), the new total and
// the line changes. It is applied by ONE function, settleAdjustmentInTx, whichever way it is
// settled: at creation when the weighing tolerance allows it (AUTO_APPROVED), or by the customer's
// explicit yes before answerBy (APPROVED). In one transaction:
//   1. the order row is locked (scoped to the caller) — every writer of an order takes this lock
//      first (transition.ts), so lines and total cannot change until the commit;
//   2. a conditional update PENDING -> settled status: the request that changes the row wins, any
//      concurrent one finds nothing pending and does nothing (one notification, sent by the winner
//      after the commit);
//   3. the order must still be what the adjustment was computed against (adjustable status, same
//      total, same available lines); otherwise the adjustment is closed unapplied (ORDER_CHANGED);
//   4. an adjustment applied without asking must be within the tolerance frozen on the order
//      (decideAdjustment, src/lib/pricing/tolerance.ts): no increase beyond it without a yes;
//   5. conditional writes of the total and of the lines, and the PRICE_ADJUSTED OrderEvent.
// How a pending adjustment ends unapplied (refusal, silence, order changed): adjustment-closure.ts.
// The previous code's automatic validation and escalation statuses are never written: they only
// remain on its rows (see AdjustmentStatus in prisma/schema.prisma).
import { Prisma, type Order, type OrderStatus, type PriceAdjustment } from "@prisma/client";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { availableLinesAfter } from "@/lib/pricing/adjustment";
import { decideAdjustment, frozenToleranceOf } from "@/lib/pricing/tolerance";
import { UNAPPLIED_STATUS, writeClosedEvent } from "./adjustment-closure";

export {
  UNAPPLIED_STATUS,
  closePendingAdjustment,
  expiredAdjustmentWhere,
  unexpiredAdjustmentWhere,
} from "./adjustment-closure";

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
export type SettledStatus = "AUTO_APPROVED" | "APPROVED";

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
  weighToleranceRateBps: number | null;
  weighToleranceCapCents: number | null;
  estimatedTotalCents: number | null;
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
  const rows = await tx.$queryRaw<LockedOrder[]>`
    SELECT "id", "shop_id" AS "shopId", "user_id" AS "userId", "status",
      "total_cents" AS "totalCents", "weigh_tolerance_rate_bps" AS "weighToleranceRateBps",
      "weigh_tolerance_cap_cents" AS "weighToleranceCapCents",
      "estimated_total_cents" AS "estimatedTotalCents"
    FROM "orders" WHERE "id" = ${orderId} ${scopeSql} FOR UPDATE`;
  return rows[0] ?? null;
}

export type SettleOutcome =
  | { kind: "settled"; adjustment: PriceAdjustment; order: Order }
  /** No pending adjustment matched: none, already settled or refused, or past its deadline. */
  | { kind: "not_pending" }
  /** The order changed since the adjustment was computed: closed unapplied. */
  | { kind: "order_changed" }
  | { kind: "not_found" };

async function closeUnapplied(
  tx: Tx,
  adjustment: PriceAdjustment,
  now: Date,
  actorId: string
): Promise<SettleOutcome> {
  await tx.priceAdjustment.update({
    where: { id: adjustment.id },
    data: { status: UNAPPLIED_STATUS, closeReason: "ORDER_CHANGED", respondedAt: now },
  });
  await writeClosedEvent(tx, adjustment, "ORDER_CHANGED", actorId);
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
    /** Who settles it: the butcher (AUTO_APPROVED) or the customer (APPROVED). */
    actorId: string;
    /** Extra conditions on the adjustment (answer window not passed). */
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
    return closeUnapplied(tx, adjustment, input.now, input.actorId);
  }
  const items = await tx.orderItem.findMany({
    where: { orderId: order.id },
    select: { id: true, available: true, totalCents: true, estimatedPriceCents: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const unchanged = lines.every((line) => {
    const item = itemById.get(line.orderItemId);
    return item !== undefined && item.available && item.totalCents === line.oldTotalCents;
  });
  if (!unchanged) return closeUnapplied(tx, adjustment, input.now, input.actorId);

  const decision = decideAdjustment({
    adjustmentType: adjustment.adjustmentType,
    currentTotalCents: order.totalCents,
    newTotalCents: adjustment.newTotal,
    tolerance: frozenToleranceOf(order),
    lines: availableLinesAfter(items, lines),
  });
  if (input.settledAs === "AUTO_APPROVED" && decision.decision !== "APPLY") {
    throw new Error(
      `Adjustment of order ${order.id} needs the customer's yes (${decision.reason})`
    );
  }

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
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      shopId: order.shopId,
      type: "PRICE_ADJUSTED",
      actorId: input.actorId,
      payloadJson: {
        from: adjustment.originalTotal,
        to: adjustment.newTotal,
        settledAs: input.settledAs,
        adjustmentType: adjustment.adjustmentType,
        toleranceCents: decision.toleranceCents,
        cumulatedIncreaseCents: decision.cumulatedIncreaseCents,
      },
    },
  });
  return {
    kind: "settled",
    adjustment,
    order: await tx.order.findUniqueOrThrow({ where: { id: order.id } }),
  };
}
