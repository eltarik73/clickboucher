// src/lib/services/stripe/webhook/payment-intent-events.ts — PaymentIntent events (platform scope).
//
// May write, on an online order designated by metadata.orderId and bound to this PaymentIntent or to
// none yet (the write binds it), each column once:
// - amount_capturable_updated: paymentAuthorizedAt, authorizedAmountCents, stripeChargeId, and
//   captureBefore / cardNetwork when the payload carries the expanded charge (no retrieval here);
// - succeeded: paidAt and capturedAmountCents (stripeFeeCents is left to a later reconciliation);
// - canceled: paymentReleasedAt.
// payment_failed writes nothing: a declined card may be followed by another card in the same session.
// Never the status: none of them accepts, announces nor auto-accepts an order (phase B). No Stripe
// call, no transaction, no notification.
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { metadataOrderId, onlineOrderWhere, recordOnOnlineOrder, stripeIdOf } from "./online-order";

function contextOf(paymentIntent: Stripe.PaymentIntent) {
  return { paymentIntentId: paymentIntent.id, orderId: metadataOrderId(paymentIntent.metadata) };
}

/** Card details of the latest charge when the payload carries it expanded, else nothing. */
function expandedCardDetails(latestCharge: Stripe.PaymentIntent["latest_charge"]) {
  if (latestCharge === null || typeof latestCharge === "string") return {};
  const card = latestCharge.payment_method_details?.card;
  return {
    ...(card?.capture_before !== undefined && {
      captureBefore: new Date(card.capture_before * 1000),
    }),
    ...(card?.network && { cardNetwork: card.network }),
  };
}

/** The card was authorized: records the hold (manual capture). */
export async function onPaymentIntentAmountCapturableUpdated(
  paymentIntent: Stripe.PaymentIntent,
  now: Date
): Promise<void> {
  const context = {
    ...contextOf(paymentIntent),
    amountCapturable: paymentIntent.amount_capturable,
  };
  const orderId = context.orderId;
  if (orderId === null || paymentIntent.amount_capturable <= 0) {
    logger.info(
      "[stripe/webhook] authorization not recorded: no order or nothing capturable",
      context
    );
    return;
  }
  const chargeId = stripeIdOf(paymentIntent.latest_charge);
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: { AND: [onlineOrderWhere(orderId, paymentIntent.id), { paymentAuthorizedAt: null }] },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        paymentAuthorizedAt: now,
        authorizedAmountCents: paymentIntent.amount_capturable,
        ...(chargeId !== null && { stripeChargeId: chargeId }),
        ...expandedCardDetails(paymentIntent.latest_charge),
      },
    })
  );
}

/** The money was captured. */
export async function onPaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  now: Date
): Promise<void> {
  const context = contextOf(paymentIntent);
  const orderId = context.orderId;
  if (orderId === null) {
    logger.info("[stripe/webhook] payment not recorded: no metadata.orderId", context);
    return;
  }
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: { AND: [onlineOrderWhere(orderId, paymentIntent.id), { paidAt: null }] },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        paidAt: now,
        capturedAmountCents: paymentIntent.amount_received,
      },
    })
  );
}

/** A card was declined: logged only, the order and its session stay open. */
export function onPaymentIntentPaymentFailed(paymentIntent: Stripe.PaymentIntent): void {
  logger.warn("[stripe/webhook] card payment failed", {
    ...contextOf(paymentIntent),
    code: paymentIntent.last_payment_error?.code ?? null,
    declineCode: paymentIntent.last_payment_error?.decline_code ?? null,
  });
}

/** The authorization was released without capture. */
export async function onPaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent,
  now: Date
): Promise<void> {
  const context = { ...contextOf(paymentIntent), reason: paymentIntent.cancellation_reason };
  const orderId = context.orderId;
  if (orderId === null) {
    logger.info("[stripe/webhook] release not recorded: no metadata.orderId", context);
    return;
  }
  await recordOnOnlineOrder(context, () =>
    prisma.order.updateMany({
      where: { AND: [onlineOrderWhere(orderId, paymentIntent.id), { paymentReleasedAt: null }] },
      data: { stripePaymentIntentId: paymentIntent.id, paymentReleasedAt: now },
    })
  );
}
