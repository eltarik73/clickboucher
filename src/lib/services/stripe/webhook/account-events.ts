// src/lib/services/stripe/webhook/account-events.ts — payout.failed (Connect scope).
//
// Writes nothing: a failed payout raises an alert. account.updated is not handled here: dispatch.ts
// hands the account to syncShopFromAccount (../account-sync.ts), the one writer of a shop's Stripe
// state, which the butcher's « refresh-status » also calls.
import type Stripe from "stripe";
import { logger } from "@/lib/logger";

/** The butcher's bank account refused a payout: an error, so that it reaches Sentry. */
export function onPayoutFailed(payout: Stripe.Payout, accountId: string | null): void {
  logger.error("[stripe/webhook] payout to a butcher failed", {
    payoutId: payout.id,
    accountId,
    failureCode: payout.failure_code ?? null,
    amount: payout.amount,
    currency: payout.currency,
  });
}
