// src/lib/services/stripe/webhook/refund-events.ts — refund events (platform scope).
//
// May write: Order.refundAmountCents and Order.refundedAt of an online order, from charge.refunded,
// as the ABSOLUTE amount Stripe reports (charge.amount_refunded), only when it is larger than the
// stored one: a replay or an older partial refund never lowers it. No status change (a refund does
// not decide whether the order was collected) and no commission arithmetic: who bears a refund is an
// owner decision not taken yet (D8). refund.updated and refund.failed write nothing.
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { metadataOrderId, onlineOrderWhere, recordOnOnlineOrder, stripeIdOf } from "./online-order";

/** Records the total refunded on the order's charge. */
export async function onChargeRefunded(charge: Stripe.Charge, now: Date): Promise<void> {
  const orderId = metadataOrderId(charge.metadata);
  const paymentIntentId = stripeIdOf(charge.payment_intent);
  const refunded = charge.amount_refunded;
  const context = { chargeId: charge.id, orderId, paymentIntentId, amountRefunded: refunded };
  if (paymentIntentId === null || refunded <= 0) {
    logger.warn(
      "[stripe/webhook] refund not recorded: no PaymentIntent or nothing refunded",
      context
    );
    return;
  }

  // Without metadata (charge created outside Checkout), the PaymentIntent, unique on orders, is
  // enough to find the order.
  const order: Prisma.OrderWhereInput =
    orderId === null
      ? { paymentMethod: "ONLINE", stripePaymentIntentId: paymentIntentId }
      : onlineOrderWhere(orderId, paymentIntentId);
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: {
        AND: [
          order,
          { OR: [{ refundAmountCents: null }, { refundAmountCents: { lt: refunded } }] },
        ],
      },
      data: {
        stripePaymentIntentId: paymentIntentId,
        refundAmountCents: refunded,
        refundedAt: now,
      },
    })
  );
}

export function onRefundUpdated(refund: Stripe.Refund): void {
  logger.info("[stripe/webhook] refund updated", {
    refundId: refund.id,
    status: refund.status,
    amount: refund.amount,
    paymentIntentId: stripeIdOf(refund.payment_intent),
  });
}

/** The customer was NOT refunded: an error, so that it reaches Sentry. */
export function onRefundFailed(refund: Stripe.Refund): void {
  logger.error("[stripe/webhook] refund failed", {
    refundId: refund.id,
    failureReason: refund.failure_reason ?? null,
    amount: refund.amount,
    paymentIntentId: stripeIdOf(refund.payment_intent),
    orderId: metadataOrderId(refund.metadata),
  });
}
