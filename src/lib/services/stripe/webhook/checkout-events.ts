// src/lib/services/stripe/webhook/checkout-events.ts — Checkout Session events (platform scope).
//
// May write:
// - checkout.session.completed: Order.stripeCheckoutSessionId and Order.stripePaymentIntentId of an
//   online order, where they are NULL or already equal. Never the status, never paidAt: only the
//   payment_intent.* events record money (with manual capture a completed session is a hold).
// - checkout.session.expired: the only status change of the webhook, through transitionOrder:
//   PENDING -> AUTO_CANCELLED for an online order neither authorized nor paid, with the effects of
//   every closing transition (releaseClosedOrder: pending adjustment, promo code or loyalty reward,
//   limited stock), then the ORDER_EXPIRED notification to the customer after commit.
// No Stripe call. Neither handler accepts, announces nor auto-accepts an order: that is phase B.
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { releaseClosedOrder } from "@/lib/services/orders/commands/close";
import { SYSTEM_ACTOR_ID, transitionOrder } from "@/lib/services/orders/transition";
import { metadataOrderId, onlineOrderWhere, recordOnOnlineOrder, stripeIdOf } from "./online-order";

/** payload.reason of the AUTO_CANCELLED OrderEvent written on an expired session. */
const CHECKOUT_SESSION_EXPIRED_REASON = "CHECKOUT_SESSION_EXPIRED";

function sessionOrNull(sessionId: string): Prisma.OrderWhereInput {
  return { OR: [{ stripeCheckoutSessionId: null }, { stripeCheckoutSessionId: sessionId }] };
}

/** Links the session and its PaymentIntent to the order. */
export async function onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = metadataOrderId(session.metadata);
  const paymentIntentId = stripeIdOf(session.payment_intent);
  const context = { sessionId: session.id, orderId, paymentIntentId };
  if (orderId === null) {
    logger.warn("[stripe/webhook] checkout.session.completed without metadata.orderId", context);
    return;
  }

  const order: Prisma.OrderWhereInput =
    paymentIntentId === null
      ? { id: orderId, paymentMethod: "ONLINE" }
      : onlineOrderWhere(orderId, paymentIntentId);
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: { AND: [order, sessionOrNull(session.id)] },
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

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      paymentMethod: true,
      userId: true,
      orderNumber: true,
      shop: { select: { name: true } },
    },
  });
  if (order === null || order.paymentMethod !== "ONLINE") {
    logger.warn("[stripe/webhook] checkout.session.expired for no online order", context);
    return;
  }

  const outcome = await transitionOrder({
    orderId,
    scope: { system: true },
    from: ["PENDING"],
    to: "AUTO_CANCELLED",
    where: {
      paymentMethod: "ONLINE",
      paymentAuthorizedAt: null,
      paidAt: null,
      ...sessionOrNull(session.id),
    },
    data: { autoCancelledAt: now },
    event: {
      type: "AUTO_CANCELLED",
      actorId: SYSTEM_ACTOR_ID,
      payload: { reason: CHECKOUT_SESSION_EXPIRED_REASON, checkoutSessionId: session.id },
    },
    effects: releaseClosedOrder,
  });
  if (!outcome.ok) {
    logger.info("[stripe/webhook] expired session leaves the order as it is", {
      ...context,
      outcome: outcome.reason,
      ...(outcome.reason === "CONFLICT" && { currentStatus: outcome.currentStatus }),
    });
    return;
  }

  const [notified] = await Promise.allSettled([
    sendNotification("ORDER_EXPIRED", {
      userId: order.userId,
      orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    }),
  ]);
  if (notified.status === "rejected") {
    logger.error("[stripe/webhook] ORDER_EXPIRED notification failed", {
      ...context,
      error: notified.reason,
    });
  }
}
