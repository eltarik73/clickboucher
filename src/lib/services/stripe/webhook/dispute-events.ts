// src/lib/services/stripe/webhook/dispute-events.ts — card disputes (platform scope).
//
// May write: the stripe_disputes table only, one row per dispute id. Reads orders to copy the order
// and its shop onto the row when it is created.
// - The first event that tells us about a dispute inserts its row and raises an alert
//   (logger.error, Sentry): a dispute has a response deadline (dueBy).
// - charge.dispute.updated refreshes the row while it is open.
// - charge.dispute.closed records the outcome and closedAt; a closed row is never reopened by a late
//   event, and a late charge.dispute.created never overwrites a newer state.
// No Stripe call (taking back the butcher's transfer on a lost dispute is phase B).
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { stripeIdOf } from "./online-order";

type DisputeStage = "created" | "updated" | "closed";

function stateOf(dispute: Stripe.Dispute) {
  const dueBy = dispute.evidence_details?.due_by ?? null;
  return {
    amountCents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    dueBy: dueBy === null ? null : new Date(dueBy * 1000),
  };
}

async function disputedOrder(chargeId: string, paymentIntentId: string | null) {
  return prisma.order.findFirst({
    where: {
      paymentMethod: "ONLINE",
      OR: [
        { stripeChargeId: chargeId },
        ...(paymentIntentId === null ? [] : [{ stripePaymentIntentId: paymentIntentId }]),
      ],
    },
    select: { id: true, shopId: true },
  });
}

/** Records what one dispute event tells, `stage` being the event type. */
export async function onDispute(
  dispute: Stripe.Dispute,
  stage: DisputeStage,
  now: Date
): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  const paymentIntentId = stripeIdOf(dispute.payment_intent);
  const state = stateOf(dispute);
  const closedAt = stage === "closed" ? now : null;
  const order = await disputedOrder(chargeId, paymentIntentId);
  const context = {
    disputeId: dispute.id,
    stage,
    chargeId,
    paymentIntentId,
    orderId: order?.id ?? null,
    shopId: order?.shopId ?? null,
    amountCents: state.amountCents,
    reason: state.reason,
    status: state.status,
    dueBy: state.dueBy,
  };

  const inserted = await prisma.stripeDispute.createMany({
    data: [
      {
        id: dispute.id,
        chargeId,
        paymentIntentId,
        orderId: order?.id ?? null,
        shopId: order?.shopId ?? null,
        livemode: dispute.livemode,
        closedAt,
        ...state,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 1) {
    logger.error("[stripe/webhook] card dispute opened: answer before dueBy", context);
  } else if (stage !== "created") {
    await prisma.stripeDispute.updateMany({
      where: { id: dispute.id, closedAt: null },
      data: { ...state, ...(closedAt !== null && { closedAt }) },
    });
  }
  if (stage === "closed") {
    const log = dispute.status === "lost" ? logger.error : logger.info;
    log("[stripe/webhook] card dispute closed", context);
  }
}
