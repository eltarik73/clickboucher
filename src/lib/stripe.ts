// src/lib/stripe.ts — Stripe client and key guard. Online payment is NOT activated.
//
// Key guard (one rule for "production": isProductionDeployment, src/lib/auth/test-mode-env.ts):
// - on the production deployment, only a live key (sk_live_, rk_live_) is accepted;
// - everywhere else, only a test key (sk_test_, rk_test_);
// - anything else is refused, and isStripeConfigured() is true only when the key is accepted.
// Without an accepted key the Stripe routes answer SERVICE_DISABLED; orders are paid at pickup.
//
// Secrets are read at call time, never at import, and never written to an error or a log.
// Network calls to Stripe go through src/lib/payments/gateway.ts, the only caller of
// getStripeClient() (tests/lib/stripe-guard.test.ts). Rules: CLAUDE.md, section « Stripe ».
import Stripe from "stripe";
import { isProductionDeployment } from "@/lib/auth/test-mode-env";

export type StripeKeyRefusal =
  | "MISSING"
  | "UNKNOWN_FORMAT"
  | "LIVE_KEY_OUTSIDE_PRODUCTION"
  | "TEST_KEY_IN_PRODUCTION";

type StripeClientConfig = NonNullable<ConstructorParameters<typeof Stripe>[1]>;

/** Secret or restricted key; the body after the prefix has no whitespace. */
const SECRET_KEY_FORMAT = /^(?:sk|rk)_(live|test)_\S+$/;
const WEBHOOK_SECRET_FORMAT = /^whsec_\S+$/;

/**
 * Options of every Stripe client.
 *
 * apiVersion: the version the installed SDK (stripe 22.1.0) was generated for, `ApiVersion` in
 * node_modules/stripe/esm/apiVersion.js; the SDK types describe that version only. The upgrade is
 * manual (.github/dependabot.yml ignores stripe): read that file again, put its value here and on
 * both webhook endpoints in the Stripe Dashboard, then replay the webhook tests.
 * timeout and maxNetworkRetries: the SDK defaults (80 s, 2 retries) outlive a 30 s function; a call
 * now lasts at most 10 s x 2 attempts.
 */
const STRIPE_CLIENT_CONFIG = {
  apiVersion: "2026-04-22.dahlia",
  timeout: 10_000,
  maxNetworkRetries: 1,
  typescript: true,
  appInfo: { name: "klikgo", version: "1.0.0" },
} as const satisfies StripeClientConfig;

/** Why `key` cannot be used on this deployment, or null when it can. Pure. */
export function stripeKeyRefusal(
  key: string | undefined,
  productionDeployment: boolean
): StripeKeyRefusal | null {
  if (!key) return "MISSING";
  const mode = SECRET_KEY_FORMAT.exec(key)?.[1];
  if (mode === "live") return productionDeployment ? null : "LIVE_KEY_OUTSIDE_PRODUCTION";
  if (mode === "test") return productionDeployment ? "TEST_KEY_IN_PRODUCTION" : null;
  return "UNKNOWN_FORMAT";
}

export function isStripeConfigured(): boolean {
  return stripeKeyRefusal(process.env.STRIPE_SECRET_KEY, isProductionDeployment()) === null;
}

let cached: { key: string; client: Stripe } | null = null;

/**
 * The Stripe client for the current key, checked on every call. Throws
 * `Stripe unavailable: <refusal>` when the key is refused. The client is reused while the key is
 * the same string. Call it only from src/lib/payments/gateway.ts.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const refusal = stripeKeyRefusal(key, isProductionDeployment());
  if (refusal) throw new Error(`Stripe unavailable: ${refusal}`);
  if (cached?.key !== key) cached = { key, client: new Stripe(key, STRIPE_CLIENT_CONFIG) };
  return cached.client;
}

function webhookSecret(value: string | undefined): string | null {
  return value && WEBHOOK_SECRET_FORMAT.test(value) ? value : null;
}

/**
 * Signing secrets of the two webhook endpoints, read at call time: "Your account" (platform) and
 * "Connected accounts" (connect). Null when unset or not a `whsec_` secret.
 */
export function stripeWebhookSecrets(): { platform: string | null; connect: string | null } {
  return {
    platform: webhookSecret(process.env.STRIPE_WEBHOOK_SECRET),
    connect: webhookSecret(process.env.STRIPE_CONNECT_WEBHOOK_SECRET),
  };
}
