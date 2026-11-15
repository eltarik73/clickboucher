// src/lib/services/stripe/account-state.ts — the one rule for the status of a butcher's Stripe
// Connect account (Shop.stripeAccountStatus). Read by the webhook on account.updated
// (webhook/account-events.ts) and by the butcher's « refresh-status » (syncShopStripeStatus,
// connect.ts). Pure: no Stripe call, no database.

export type ConnectAccountState = "active" | "pending" | "restricted";

/** The fields of a Stripe.Account the rule reads; a Stripe.Account satisfies it. */
export interface ConnectAccountFlags {
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  requirements?: { past_due?: string[] | null; disabled_reason?: string | null } | null;
}

/**
 * "active" when the account can take payments and receive payouts, "restricted" when Stripe
 * blocked it (overdue requirements, disabled), "pending" otherwise (onboarding not finished).
 */
export function connectAccountState(account: ConnectAccountFlags): ConnectAccountState {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  const pastDue = account.requirements?.past_due ?? [];
  if (pastDue.length > 0 || account.requirements?.disabled_reason) return "restricted";
  return "pending";
}
