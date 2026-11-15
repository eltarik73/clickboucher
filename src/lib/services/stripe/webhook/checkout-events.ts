// src/lib/services/stripe/webhook/checkout-events.ts — Checkout Session events (platform scope).
//
// May write:
// - checkout.session.completed: Order.stripeCheckoutSessionId and Order.stripePaymentIntentId of an
//   online order, where they are NULL or already equal. Never the status, never paidAt: only the
//   payment_intent.* events record money (with manual capture a completed session is a hold).
// - checkout.session.expired: nothing itself. The system command expireUnpaidCheckout
//   (src/lib/services/orders/commands/close.ts) closes the unpaid online order, the only status
//   change of the webhook.
// No Stripe call. Neither handler accepts, announces nor auto-accepts an order: that is phase B.
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { expireUnpaidCheckout } from "@/lib/services/orders/commands/close";
import { metadataOrderId, onlineOrderWhere, recordOnOnlineOrder, stripeIdOf } from "./online-order";

/** Links the session and its PaymentIntent to the order. */
export async function onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = metadataOrderId(session.metadata);
  const paymentIntentId = stripeIdOf(session.payment_intent);
  const context = { sessionId: session.id, orderId, paymentIntentId };
  if (orderId === null) {
    logger.warn("[stripe/webhook] checkout.session.completed without metadata.orderId", context);
    return;
  }

  const orderWhere = onlineOrderWhere(orderId, paymentIntentId);
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: {
        AND: [
          orderWhere,
          { OR: [{ stripeCheckoutSessionId: null }, { stripeCheckoutSessionId: session.id }] },
        ],
      },
      data: {
        stripeCheckoutSessionId: session.id,
        ...(paymentIntentId !== null && { stripePaymentIntentId: paymentIntentId }),
      },
    })
  );
}

/** Closes the unpaid online order whose Checkout Session expired. */
export async function onCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
  now: Date
): Promise<void> {
  const orderId = metadataOrderId(session.metadata);
  const context = { sessionId: session.id, orderId };
  if (orderId === null) {
    logger.warn("[stripe/webhook] checkout.session.expired without metadata.orderId", context);
    return;
  }

  const result = await expireUnpaidCheckout({ orderId, checkoutSessionId: session.id, now });
  if (result.kind !== "done") {
    logger.info("[stripe/webhook] expired session leaves the order as it is", {
      ...context,
      outcome: result.kind,
      ...(result.kind === "conflict" && { currentStatus: result.currentStatus }),
    });
  }
}
