// src/lib/services/orders/adjustment-answers.ts — the ways a pending price adjustment ends: its
// deadline (tier 2 validated, tier 3 escalated), the customer's acceptance or refusal. Each one
// changes the adjustment with a conditional write, so concurrent requests settle it once; the
// winner alone notifies, after the commit. The order is changed by settleAdjustmentInTx only.
import type { PriceAdjustment, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import {
  UNAPPLIED_STATUS,
  lockOrderForAdjustment,
  settleAdjustmentInTx,
} from "./adjustment-settlement";

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const NOTIFICATION_SELECT = {
  userId: true,
  shopId: true,
  orderNumber: true,
  shop: { select: { name: true } },
} satisfies Prisma.OrderSelect;

async function orderForNotification(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: NOTIFICATION_SELECT });
}

/**
 * Settles the order's adjustment whose deadline has passed: a tier-2 adjustment is validated, a
 * tier-3 adjustment is escalated to the webmaster. Settled on read until a scheduled job does it.
 */
export async function settleDueAdjustment(orderId: string, now: Date): Promise<void> {
  const adjustment = await prisma.priceAdjustment.findUnique({
    where: { orderId },
    select: {
      status: true,
      tier: true,
      autoApproveAt: true,
      escalateAt: true,
      originalTotal: true,
      newTotal: true,
    },
  });
  if (adjustment === null || adjustment.status !== "PENDING") return;

  if (
    adjustment.tier === 2 &&
    adjustment.autoApproveAt !== null &&
    adjustment.autoApproveAt <= now
  ) {
    const outcome = await prisma.$transaction(
      (tx) =>
        settleAdjustmentInTx(tx, {
          orderId,
          scope: { system: true },
          settledAs: "AUTO_VALIDATED",
          now,
          due: { tier: 2, autoApproveAt: { lte: now } },
        }),
      TRANSACTION_OPTIONS
    );
    if (outcome.kind !== "settled") return;
    const order = await orderForNotification(orderId);
    await sendNotification("PRICE_ADJUSTMENT_AUTO_VALIDATED", {
      userId: order.userId,
      orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    });
    return;
  }

  if (adjustment.tier === 3 && adjustment.escalateAt !== null && adjustment.escalateAt <= now) {
    const { count } = await prisma.priceAdjustment.updateMany({
      where: { orderId, status: "PENDING", tier: 3, escalateAt: { lte: now } },
      data: { status: "ESCALATED", respondedAt: now },
    });
    if (count !== 1) return;
    const order = await orderForNotification(orderId);
    await sendNotification("PRICE_ADJUSTMENT_ESCALATED", {
      orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      originalTotal: adjustment.originalTotal,
      newTotal: adjustment.newTotal,
      tier: 3,
    });
  }
}

/** Settles the due tier-2 adjustments of the orders matching `scope` (the caller's own authorisation). */
export async function settleDueAdjustmentsWithin(
  scope: Prisma.OrderWhereInput,
  now: Date
): Promise<void> {
  const due = await prisma.priceAdjustment.findMany({
    where: { status: "PENDING", tier: 2, autoApproveAt: { lte: now }, order: scope },
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

/** The customer accepts the pending adjustment of their order. */
export async function acceptAdjustment(input: {
  orderId: string;
  userId: string;
  now: Date;
}): Promise<CustomerAdjustmentResult> {
  const outcome = await prisma.$transaction(
    (tx) =>
      settleAdjustmentInTx(tx, {
        orderId: input.orderId,
        scope: { userId: input.userId },
        settledAs: "APPROVED",
        now: input.now,
      }),
    TRANSACTION_OPTIONS
  );
  if (outcome.kind === "not_found") return { kind: "not_found" };
  if (outcome.kind === "not_pending") return { kind: "refused", message: NOTHING_PENDING };
  if (outcome.kind === "order_changed") return { kind: "refused", message: ORDER_CHANGED_MESSAGE };

  const order = await orderForNotification(input.orderId);
  await sendNotification("PRICE_ADJUSTMENT_ACCEPTED", {
    shopId: order.shopId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
  });
  return { kind: "done", adjustment: outcome.adjustment };
}

/** The customer refuses the pending adjustment of their order: the total does not change. */
export async function rejectAdjustment(input: {
  orderId: string;
  userId: string;
  now: Date;
}): Promise<CustomerAdjustmentResult> {
  const outcome = await prisma.$transaction(async (tx) => {
    const order = await lockOrderForAdjustment(tx, input.orderId, { userId: input.userId });
    if (order === null) return null;
    const { count } = await tx.priceAdjustment.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: UNAPPLIED_STATUS, respondedAt: input.now },
    });
    return count === 1
      ? await tx.priceAdjustment.findUniqueOrThrow({ where: { orderId: order.id } })
      : undefined;
  }, TRANSACTION_OPTIONS);
  if (outcome === null) return { kind: "not_found" };
  if (outcome === undefined) return { kind: "refused", message: NOTHING_PENDING };

  const order = await orderForNotification(input.orderId);
  await sendNotification("PRICE_ADJUSTMENT_REJECTED", {
    shopId: order.shopId,
    orderId: input.orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
  });
  return { kind: "done", adjustment: outcome };
}
