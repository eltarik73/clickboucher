// src/lib/services/orders/adjustment-answers.ts — the ways a pending price adjustment ends: the
// customer's explicit yes (applied by settleAdjustmentInTx), his refusal, or his silence. Silence is
// a refusal, never an acceptance: once answerBy has passed, the adjustment is closed REJECTED with
// closeReason NO_ANSWER and the order keeps its price; a late yes is refused. Expiry happens on
// read (the order page, the kitchen board, the lists, the day summary), no scheduled job. Each way
// is a conditional write under the order lock, so concurrent requests end it once; the winner
// alone notifies, after the commit.
import type { PriceAdjustment, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import {
  endPendingAdjustment,
  expiredAdjustmentWhere,
  expirePendingAdjustment,
  unexpiredAdjustmentWhere,
  type ClosedAdjustment,
} from "./adjustment-closure";
import { lockOrderForAdjustment, settleAdjustmentInTx } from "./adjustment-settlement";

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const NOTIFICATION_SELECT = {
  shopId: true,
  orderNumber: true,
  shop: { select: { name: true } },
} satisfies Prisma.OrderSelect;

/** Tells the shop that the customer did not answer: the price stays, the butcher may act. */
export async function notifyAdjustmentExpired(closed: ClosedAdjustment): Promise<void> {
  await notifyShop("PRICE_ADJUSTMENT_EXPIRED", closed);
}

async function notifyShop(
  event: "PRICE_ADJUSTMENT_EXPIRED" | "PRICE_ADJUSTMENT_ACCEPTED" | "PRICE_ADJUSTMENT_REJECTED",
  adjustment: Pick<PriceAdjustment, "orderId" | "originalTotal" | "newTotal">
): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: adjustment.orderId },
    select: NOTIFICATION_SELECT,
  });
  await sendNotification(event, {
    shopId: order.shopId,
    orderId: adjustment.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    originalTotal: adjustment.originalTotal,
    newTotal: adjustment.newTotal,
  });
}

/**
 * Closes the order's pending adjustment whose answer window has passed (REJECTED, NO_ANSWER): the
 * total does not change. The shop is notified once, by the request that closed it.
 */
export async function settleDueAdjustment(orderId: string, now: Date): Promise<void> {
  const due = await prisma.priceAdjustment.findFirst({
    where: { AND: [{ orderId, status: "PENDING" }, expiredAdjustmentWhere(now)] },
    select: { id: true },
  });
  if (due === null) return;
  const expired = await prisma.$transaction(async (tx) => {
    const order = await lockOrderForAdjustment(tx, orderId, { system: true });
    return order === null ? null : expirePendingAdjustment(tx, order.id, now);
  }, TRANSACTION_OPTIONS);
  if (expired !== null) await notifyAdjustmentExpired(expired);
}

/** Closes the expired adjustments of the orders matching `scope` (the caller's own authorisation). */
export async function settleDueAdjustmentsWithin(
  scope: Prisma.OrderWhereInput,
  now: Date
): Promise<void> {
  const due = await prisma.priceAdjustment.findMany({
    where: { AND: [{ status: "PENDING", order: scope }, expiredAdjustmentWhere(now)] },
    select: { orderId: true },
  });
  for (const { orderId } of due) await settleDueAdjustment(orderId, now);
}

export type CustomerAdjustmentResult =
  | { kind: "done"; adjustment: PriceAdjustment }
  | { kind: "not_found" }
  | { kind: "refused"; message: string };

const NOTHING_PENDING = "Aucun ajustement en attente";
const ORDER_CHANGED_MESSAGE =
  "La commande a changé depuis cet ajustement : il n'est plus applicable.";
const ANSWER_TOO_LATE =
  "Le délai de réponse est dépassé : le prix de votre commande n'a pas changé.";

/**
 * The customer accepts the pending adjustment of their order, before its answer window ends. A yes
 * after it is refused: the adjustment is closed NO_ANSWER and nothing changes.
 */
export async function acceptAdjustment(input: {
  orderId: string;
  userId: string;
  now: Date;
}): Promise<CustomerAdjustmentResult> {
  const { outcome, expired } = await prisma.$transaction(async (tx) => {
    const settled = await settleAdjustmentInTx(tx, {
      orderId: input.orderId,
      scope: { userId: input.userId },
      settledAs: "APPROVED",
      now: input.now,
      actorId: input.userId,
      due: unexpiredAdjustmentWhere(input.now),
    });
    return {
      outcome: settled,
      expired:
        settled.kind === "not_pending"
          ? await expirePendingAdjustment(tx, input.orderId, input.now)
          : null,
    };
  }, TRANSACTION_OPTIONS);
  if (expired !== null) {
    await notifyAdjustmentExpired(expired);
    return { kind: "refused", message: ANSWER_TOO_LATE };
  }
  if (outcome.kind === "not_found") return { kind: "not_found" };
  if (outcome.kind === "not_pending") return { kind: "refused", message: NOTHING_PENDING };
  if (outcome.kind === "order_changed") return { kind: "refused", message: ORDER_CHANGED_MESSAGE };

  await notifyShop("PRICE_ADJUSTMENT_ACCEPTED", outcome.adjustment);
  return { kind: "done", adjustment: outcome.adjustment };
}

/**
 * The customer refuses the pending adjustment of their order: the total does not change
 * (CUSTOMER_REFUSED). After the answer window it is closed as unanswered (NO_ANSWER), with the
 * same result for the order.
 */
export async function rejectAdjustment(input: {
  orderId: string;
  userId: string;
  now: Date;
}): Promise<CustomerAdjustmentResult> {
  const outcome = await prisma.$transaction(async (tx) => {
    const order = await lockOrderForAdjustment(tx, input.orderId, { userId: input.userId });
    if (order === null) return null;
    const refused = await endPendingAdjustment(tx, {
      orderId: order.id,
      now: input.now,
      reason: "CUSTOMER_REFUSED",
      actorId: input.userId,
      where: unexpiredAdjustmentWhere(input.now),
    });
    const expired =
      refused === null ? await expirePendingAdjustment(tx, order.id, input.now) : null;
    if (refused === null && expired === null) return undefined;
    return {
      refused,
      expired,
      adjustment: await tx.priceAdjustment.findUniqueOrThrow({ where: { orderId: order.id } }),
    };
  }, TRANSACTION_OPTIONS);
  if (outcome === null) return { kind: "not_found" };
  if (outcome === undefined) return { kind: "refused", message: NOTHING_PENDING };

  if (outcome.expired !== null) await notifyAdjustmentExpired(outcome.expired);
  if (outcome.refused !== null) await notifyShop("PRICE_ADJUSTMENT_REJECTED", outcome.refused);
  return { kind: "done", adjustment: outcome.adjustment };
}
