// src/lib/services/stripe/account-sync.ts — the one writer of a shop's Stripe Connect state.
//
// Writes, on the shops table only: stripeAccountStatus, stripeChargesEnabled,
// stripePayoutsEnabled, stripeRequirementsDue, stripeDisabledReason, stripeCardPaymentsActive,
// acceptOnline (only ever to false) and stripeAccountId (only on a shop that holds no account yet).
// Called with the account Stripe sent (account.updated, webhook/dispatch.ts) or the one the
// butcher's « refresh-status » re-read (syncShopStripeStatus, connect.ts). No Stripe call.
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { connectAccountState } from "./account-state";

/**
 * Copies the account state onto the shop that holds the account. The first event of a new account
 * can arrive before the onboarding route stored its id: the shop named by metadata.shopId then gets
 * it, but only if it holds no account yet (never re-pointed to another account).
 */
export async function syncShopFromAccount(account: Stripe.Account): Promise<void> {
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
    // A shop can no longer be offered online payment once Stripe stops its card payments. No sync
    // switches it back on: that is the butcher's choice.
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
    logger.info("[stripe/account-sync] shop Stripe account synced", context);
    return;
  }
  if (shopId === null) {
    logger.warn("[stripe/account-sync] account state for an account no shop holds", context);
    return;
  }
  const attached = await prisma.shop.updateMany({
    where: { id: shopId, stripeAccountId: null },
    data: { ...columns, stripeAccountId: account.id },
  });
  if (attached.count === 0) {
    logger.warn(
      "[stripe/account-sync] account not attached: unknown shop or shop with another account",
      context
    );
    return;
  }
  logger.info("[stripe/account-sync] Stripe account attached to its shop", context);
}
