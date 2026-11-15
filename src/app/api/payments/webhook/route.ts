// POST /api/payments/webhook — Stripe webhook, dormant: online payment is refused at order creation
// and production holds no Stripe key, so this route answers 503 there.
//
// Steps: configuration (503) -> signature, platform secret then Connect secret (400, nothing
// written) -> livemode against the deployment (200 ignored, nothing written) -> handler and scope of
// the event type (200 ignored) -> ledger claim (200 duplicate, 409 in progress) -> handler -> event
// marked handled. A failed handler releases its claim and answers 500 so that Stripe retries.
// What each handler may write: src/lib/services/stripe/webhook/*. No Clerk here: the route stays out
// of the middleware matcher (src/lib/__tests__/middleware-matcher.test.ts).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isProductionDeployment } from "@/lib/auth/test-mode-env";
import { logger } from "@/lib/logger";
import { isStripeConfigured, stripeWebhookSecrets } from "@/lib/stripe";
import { routeStripeEvent } from "@/lib/services/stripe/webhook/dispatch";
import {
  claimStripeEvent,
  markStripeEventHandled,
  releaseStripeEvent,
} from "@/lib/services/stripe/webhook/ledger";
import { verifyStripeWebhook } from "@/lib/services/stripe/webhook/verify";

const received = (extra: Record<string, unknown> = {}) =>
  NextResponse.json({ received: true, ...extra });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secrets = stripeWebhookSecrets();
  if (!isStripeConfigured() || (secrets.platform === null && secrets.connect === null)) {
    logger.warn("[stripe/webhook] Stripe not configured");
    return NextResponse.json({ received: false, reason: "not-configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  try {
    const verified = verifyStripeWebhook(await req.text(), signature, secrets);
    if (verified === null) {
      logger.warn("[stripe/webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const { event, scope } = verified;
    const context = { eventId: event.id, type: event.type, scope, account: event.account ?? null };

    if (event.livemode !== isProductionDeployment()) {
      logger.warn("[stripe/webhook] event mode does not match the deployment", context);
      return received({ ignored: "livemode" });
    }
    const route = routeStripeEvent(event, scope);
    if (route.kind === "ignore") {
      const log = route.reason === "scope" ? logger.warn : logger.info;
      log("[stripe/webhook] event ignored", { ...context, reason: route.reason });
      return received({ ignored: route.reason });
    }

    const now = new Date();
    const claim = await claimStripeEvent(event, now);
    if (claim === "duplicate") return received({ duplicate: true });
    if (claim === "in_progress") {
      return NextResponse.json({ received: false, reason: "in-progress" }, { status: 409 });
    }
    try {
      await route.run(now);
      await markStripeEventHandled(event.id, new Date());
    } catch (error) {
      logger.error("[stripe/webhook] event processing failed, releasing its claim", {
        ...context,
        error,
      });
      await releaseStripeEvent(event.id);
      return NextResponse.json({ error: "Handler error" }, { status: 500 });
    }
    logger.info("[stripe/webhook] event handled", context);
    return received();
  } catch (error) {
    logger.error("[stripe/webhook] webhook processing failed", { error });
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
