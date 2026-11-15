// src/lib/services/stripe/webhook/account-events.ts — connected account events (Connect scope).
//
// May write, on the shops table only, from account.updated: stripeAccountStatus,
// stripeChargesEnabled, stripePayoutsEnabled, stripeRequirementsDue, stripeDisabledReason,
// stripeCardPaymentsActive, acceptOnline (only ever to false) and stripeAccountId (only on a shop
// that holds no account yet). The payload is the state at the time of the event; no Stripe call
// (the butcher's « refresh-status » re-reads the account when needed). payout.failed writes nothing.
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type ConnectAccountState = "active" | "pending" | "restricted";

/**
 * Shop.stripeAccountStatus: "active" when the account can take payments and receive payouts,
 * "restricted" when Stripe blocked it (overdue requirements, disabled), "pending" otherwise
 * (onboarding not finished). Same rule as syncShopStripeStatus in src/lib/services/stripe/connect.ts.
 */
export function connectAccountState(account: Stripe.Account): ConnectAccountState {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  const pastDue = account.requirements?.past_due ?? [];
  if (pastDue.length > 0 || account.requirements?.disabled_reason) return "restricted";
  return "pending";
}

/**
 * Copies the account state onto the shop that holds the account. The first event of a new account
 * can arrive before the onboarding route stored its id: the shop named by metadata.shopId then gets
 * it, but only if it holds no account yet (never re-pointed to another account).
 */
export async function onAccountUpdated(account: Stripe.Account): Promise<void> {
  const requirements = account.requirements;
  const chargesEnabled = account.charges_enabled === true;
  const cardPaymentsActive = account.capabilities?.card_payments === "active";
  const requirementsDue = [
    ...new Set([...(requirements?.currently_due ?? []), ...(requirements?.past_due ?? [])]),
  ];
  // `as const`: the shop writers guard (src/lib/__tests__/shop-visible-writers.test.ts) reads the
  // written columns of a constant object of the same file.
  const columns = {
    stripeAccountStatus: connectAccountState(account),
    stripeChargesEnabled: chargesEnabled,
    stripePayoutsEnabled: account.payouts_enabled === true,
    stripeRequirementsDue: requirementsDue,
    stripeDisabledReason: requirements?.disabled_reason ?? null,
    stripeCardPaymentsActive: cardPaymentsActive,
    // A shop can no longer be offered online payment once Stripe stops its card payments. The
    // webhook never switches it back on: that is the butcher's choice.
    ...(!(chargesEnabled && cardPaymentsActive) && { acceptOnline: false }),
  } as const;
  const shopId = account.metadata?.shopId ?? null;
  const context = {
    accountId: account.id,
    shopId,
    status: columns.stripeAccountStatus,
    chargesEnabled,
    cardPaymentsActive,
  };

  const byAccount = await prisma.shop.updateMany({
    where: { stripeAccountId: account.id },
    data: columns,
  });
  if (byAccount.count > 0) {
    logger.info("[stripe/webhook] shop Stripe account synced", context);
    return;
  }
  if (shopId === null) {
    logger.warn("[stripe/webhook] account.updated for an account no shop holds", context);
    return;
  }
  const attached = await prisma.shop.updateMany({
    where: { id: shopId, stripeAccountId: null },
    data: { ...columns, stripeAccountId: account.id },
  });
  if (attached.count === 0) {
    logger.warn(
      "[stripe/webhook] account not attached: unknown shop or shop with another account",
      context
    );
    return;
  }
  logger.info("[stripe/webhook] Stripe account attached to its shop", context);
}

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
