// POST /api/payments/webhook — Stripe webhook (signature verified)
//
// Foundations only — Stripe is not yet activated. While STRIPE_SECRET_KEY /
// STRIPE_WEBHOOK_SECRET are unset, this route returns 503 and no event is
// processed. See audit/stripe-activation.md for activation steps.
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // crucial — webhook signature needs raw bytes, not Edge

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  isStripeConfigured,
} from "@/lib/stripe";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !STRIPE_WEBHOOK_SECRET) {
    logger.warn("[stripe/webhook] Stripe not configured — skipping");
    return NextResponse.json(
      { received: false, reason: "not-configured" },
      { status: 503 },
    );
  }

  // Read as raw text — Stripe signature is computed on the byte stream.
  // Do NOT use req.json() here.
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn("[stripe/webhook] signature verification failed", {
      err: (err as Error).message,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // TODO: Idempotency — persist event.id in StripeEvent (model exists, see
  // schema.prisma). On duplicate, return 200 immediately without re-running
  // the handler. Skipped for now while Stripe is not activated.

  logger.info("[stripe/webhook] received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        // TODO: handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break;
      case "payment_intent.succeeded":
        // TODO: handlePaymentIntentSucceeded
        break;
      case "payment_intent.payment_failed":
        // TODO: handlePaymentIntentFailed
        break;
      case "charge.refunded":
        // TODO: handleChargeRefunded
        break;
      case "account.updated":
        // TODO: Stripe Connect — sync boucher onboarding status (Shop.stripe*)
        break;
      default:
        logger.debug("[stripe/webhook] unhandled event type", {
          type: event.type,
        });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("[stripe/webhook] handler error", {
      err: (err as Error).message,
    });
    // Return 500 so Stripe retries. Once handlers persist via StripeEvent
    // idempotency, retries will be safe.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
