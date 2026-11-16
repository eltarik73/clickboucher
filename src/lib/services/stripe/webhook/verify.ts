// src/lib/services/stripe/webhook/verify.ts — signature check of a Stripe webhook delivery.
//
// Writes nothing. Local cryptography only: the static Stripe.webhooks.constructEvent (HMAC of the
// raw body, timestamp tolerance of 5 minutes, the SDK default), never a Stripe client and never a
// network call.
//
// Stripe signs the events of a Connect platform with two endpoint secrets: "Your account"
// (payments, refunds, disputes of destination charges) and "Connected accounts" (account.updated,
// payout.*). The secret that verifies a delivery tells its scope, which dispatch.ts checks against
// the event type.
import Stripe from "stripe";

export type WebhookScope = "platform" | "connect";

/**
 * The verified event and its scope: the platform secret is tried first, then the Connect secret.
 * Null when no configured secret verifies the signature. Any other error (a correctly signed body
 * that is not JSON) is thrown.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signature: string,
  secrets: { platform: string | null; connect: string | null }
): { event: Stripe.Event; scope: WebhookScope } | null {
  const candidates: ReadonlyArray<readonly [WebhookScope, string | null]> = [
    ["platform", secrets.platform],
    ["connect", secrets.connect],
  ];
  for (const [scope, secret] of candidates) {
    if (secret === null) continue;
    try {
      return { event: Stripe.webhooks.constructEvent(rawBody, signature, secret), scope };
    } catch (error) {
      if (!(error instanceof Stripe.errors.StripeSignatureVerificationError)) throw error;
    }
  }
  return null;
}
