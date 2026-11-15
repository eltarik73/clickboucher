// src/lib/services/orders/adjustment-closure.ts — how a pending price adjustment ends unapplied.
//
// A pending adjustment is closed REJECTED, with its closeReason and a PRICE_ADJUSTMENT_CLOSED
// OrderEvent in the same transaction, when the customer refuses it (CUSTOMER_REFUSED), when its
// answer window passes (NO_ANSWER: silence is a refusal, never an acceptance), or when a transition
// changes the lines or closes the order (ORDER_CHANGED). Every closure is one conditional write on
// the PENDING row: of two concurrent closures, one changes the row and writes the event, the other
// finds nothing pending. Applying an adjustment: adjustment-settlement.ts.
import type { AdjustmentCloseReason, PriceAdjustment, Prisma } from "@prisma/client";

import { ADJUSTMENT_ANSWER_WINDOW_SECONDS } from "@/lib/pricing/tolerance";
import { SYSTEM_ACTOR_ID } from "./transition";

type Tx = Prisma.TransactionClient;

/** Status of an adjustment that ended without being applied (refused, unanswered, order changed). */
export const UNAPPLIED_STATUS = "REJECTED";

/** Rows written before answerBy existed are answered within the window after their creation. */
function windowStart(now: Date): Date {
  return new Date(now.getTime() - ADJUSTMENT_ANSWER_WINDOW_SECONDS * 1000);
}

/** A pending adjustment the customer may still answer at `now`. */
export function unexpiredAdjustmentWhere(now: Date): Prisma.PriceAdjustmentWhereInput {
  return {
    OR: [{ answerBy: { gt: now } }, { answerBy: null, createdAt: { gt: windowStart(now) } }],
  };
}

/** A pending adjustment whose answer window has passed at `now`: silence is a refusal. */
export function expiredAdjustmentWhere(now: Date): Prisma.PriceAdjustmentWhereInput {
  return {
    OR: [{ answerBy: { lte: now } }, { answerBy: null, createdAt: { lte: windowStart(now) } }],
  };
}

/** What a closed adjustment proposed, for its OrderEvent and the notification of its closure. */
export type ClosedAdjustment = Pick<
  PriceAdjustment,
  "id" | "orderId" | "shopId" | "originalTotal" | "newTotal" | "adjustmentType"
>;

/** The PRICE_ADJUSTMENT_CLOSED OrderEvent, written in the transaction of the closure. */
export async function writeClosedEvent(
  tx: Tx,
  closed: ClosedAdjustment,
  reason: AdjustmentCloseReason,
  actorId: string
): Promise<void> {
  await tx.orderEvent.create({
    data: {
      orderId: closed.orderId,
      shopId: closed.shopId,
      type: "PRICE_ADJUSTMENT_CLOSED",
      actorId,
      payloadJson: {
        reason,
        from: closed.originalTotal,
        to: closed.newTotal,
        adjustmentType: closed.adjustmentType,
      },
    },
  });
}

/**
 * Ends the order's pending adjustment unapplied (REJECTED with `reason`) when it also matches
 * `where`, and writes its OrderEvent; null when no row was closed. The caller holds the order lock.
 */
export async function endPendingAdjustment(
  tx: Tx,
  input: {
    orderId: string;
    now: Date;
    reason: AdjustmentCloseReason;
    actorId: string;
    where?: Prisma.PriceAdjustmentWhereInput;
  }
): Promise<ClosedAdjustment | null> {
  const [closed] = await tx.priceAdjustment.updateManyAndReturn({
    where: { AND: [{ orderId: input.orderId, status: "PENDING" }, input.where ?? {}] },
    data: { status: UNAPPLIED_STATUS, closeReason: input.reason, respondedAt: input.now },
    select: {
      id: true,
      orderId: true,
      shopId: true,
      originalTotal: true,
      newTotal: true,
      adjustmentType: true,
    },
  });
  if (closed === undefined) return null;
  await writeClosedEvent(tx, closed, input.reason, input.actorId);
  return closed;
}

/**
 * Closes the order's pending adjustment unapplied. Called in the transaction of every transition
 * that changes the lines or ends the order: an adjustment computed against the old content must
 * never be applied to the new one.
 */
export async function closePendingAdjustment(
  tx: Tx,
  orderId: string,
  now: Date,
  reason: AdjustmentCloseReason = "ORDER_CHANGED"
): Promise<void> {
  await endPendingAdjustment(tx, { orderId, now, reason, actorId: SYSTEM_ACTOR_ID });
}

/** Closes the order's pending adjustment when its answer window has passed (NO_ANSWER). */
export async function expirePendingAdjustment(
  tx: Tx,
  orderId: string,
  now: Date
): Promise<ClosedAdjustment | null> {
  return endPendingAdjustment(tx, {
    orderId,
    now,
    reason: "NO_ANSWER",
    actorId: SYSTEM_ACTOR_ID,
    where: expiredAdjustmentWhere(now),
  });
}
