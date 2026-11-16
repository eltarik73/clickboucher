// src/lib/services/stripe/webhook/dispatch.ts — which handler runs a verified Stripe event.
//
// Writes nothing itself. Each subscribed event type has one handler and one scope: the endpoint
// whose secret must have verified it (verify.ts). An event of a known type verified by the other
// secret is ignored with a warning (an endpoint subscribed to the wrong events, or a forged scope);
// an unknown type is ignored. The events to subscribe in the Stripe Dashboard are the cases below:
// `platform` ones on the "Your account" endpoint, `connect` ones on the "Connected accounts" one.
// The switch narrows `event`, so every handler receives the object type of its event.
import type Stripe from "stripe";
import { syncShopFromAccount } from "../account-sync";
import { onPayoutFailed } from "./account-events";
import { onCheckoutSessionCompleted, onCheckoutSessionExpired } from "./checkout-events";
import { onDispute } from "./dispute-events";
import {
  onPaymentIntentAmountCapturableUpdated,
  onPaymentIntentCanceled,
  onPaymentIntentPaymentFailed,
  onPaymentIntentSucceeded,
} from "./payment-intent-events";
import { onChargeRefunded, onRefundFailed, onRefundUpdated } from "./refund-events";
import type { WebhookScope } from "./verify";

type Run = (now: Date) => Promise<void> | void;

type StripeEventRoute =
  | { kind: "handle"; run: Run }
  | { kind: "ignore"; reason: "scope" | "type" };

function handlerOf(event: Stripe.Event): { scope: WebhookScope; run: Run } | null {
  const platform = (run: Run) => ({ scope: "platform" as const, run });
  const connect = (run: Run) => ({ scope: "connect" as const, run });
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      return platform(() => onCheckoutSessionCompleted(session));
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      return platform((now) => onCheckoutSessionExpired(session, now));
    }
    case "payment_intent.amount_capturable_updated": {
      const paymentIntent = event.data.object;
      return platform((now) => onPaymentIntentAmountCapturableUpdated(paymentIntent, now));
    }
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      return platform((now) => onPaymentIntentSucceeded(paymentIntent, now));
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      return platform(() => onPaymentIntentPaymentFailed(paymentIntent));
    }
    case "payment_intent.canceled": {
      const paymentIntent = event.data.object;
      return platform((now) => onPaymentIntentCanceled(paymentIntent, now));
    }
    case "charge.refunded": {
      const charge = event.data.object;
      return platform((now) => onChargeRefunded(charge, now));
    }
    case "refund.updated": {
      const refund = event.data.object;
      return platform(() => onRefundUpdated(refund));
    }
    case "refund.failed": {
      const refund = event.data.object;
      return platform(() => onRefundFailed(refund));
    }
    case "charge.dispute.created": {
      const dispute = event.data.object;
      return platform((now) => onDispute(dispute, "created", now));
    }
    case "charge.dispute.updated": {
      const dispute = event.data.object;
      return platform((now) => onDispute(dispute, "updated", now));
    }
    case "charge.dispute.closed": {
      const dispute = event.data.object;
      return platform((now) => onDispute(dispute, "closed", now));
    }
    case "account.updated": {
      const account = event.data.object;
      return connect(() => syncShopFromAccount(account));
    }
    case "payout.failed": {
      const payout = event.data.object;
      const accountId = event.account ?? null;
      return connect(() => onPayoutFailed(payout, accountId));
    }
    default:
      return null;
  }
}

/** The handler of a verified event, or why it is ignored. */
export function routeStripeEvent(event: Stripe.Event, scope: WebhookScope): StripeEventRoute {
  const handler = handlerOf(event);
  if (handler === null) return { kind: "ignore", reason: "type" };
  if (handler.scope !== scope) return { kind: "ignore", reason: "scope" };
  return { kind: "handle", run: handler.run };
}
