// src/lib/stripe.ts — Stripe SDK singleton (foundations only, NOT activated)
//
// Activation is gated on STRIPE_SECRET_KEY being present in env. As long as
// it is missing, isStripeConfigured() returns false and all callers fall back
// to "paiement sur place" (the only payment mode currently supported).
//
// See audit/stripe-activation.md for the 10-step activation checklist.
import Stripe from "stripe";

let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripeClient(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing");
    _client = new Stripe(key, {
      // Pin a Basil API version (latest stable family at install time).
      // Bump this when upgrading the SDK + after re-testing webhooks.
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
      appInfo: { name: "klikgo", version: "1.0.0" },
    });
  }
  return _client;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
