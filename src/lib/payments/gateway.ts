// src/lib/payments/gateway.ts — the one door to the Stripe API.
//
// Every network call the application makes to Stripe goes through this module; each method is
// exactly one call on getStripeClient() (src/lib/stripe.ts), which refuses a key that does not
// match the deployment before anything leaves the server.
// - Never call the gateway inside a Prisma transaction (prisma.$transaction, the effects of a
//   transition): a Stripe call can last timeout x (retries + 1) while the transaction holds its row
//   locks. Commit, then call Stripe, then record the result in a new write.
// - Integration tests replace this module with tests/integration/helpers/fake-payment-gateway.ts
//   (vi.mock("@/lib/payments/gateway")); Prisma itself is never mocked.
// - Verifying a webhook signature is local cryptography (Stripe.webhooks), not a network call: it
//   does not belong here.
// tests/lib/stripe-guard.test.ts checks that this module is the only caller of getStripeClient()
// and that no file both opens a transaction and calls the gateway; a call reached from a
// transition's effects in another file is left to review.
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";

export interface PaymentGateway {
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    options?: Stripe.RequestOptions
  ): Promise<Stripe.Checkout.Session>;
  createConnectAccount(
    params: Stripe.AccountCreateParams,
    options?: Stripe.RequestOptions
  ): Promise<Stripe.Account>;
  createAccountLink(params: Stripe.AccountLinkCreateParams): Promise<Stripe.AccountLink>;
  createLoginLink(accountId: string): Promise<Stripe.LoginLink>;
  retrieveAccount(accountId: string): Promise<Stripe.Account>;
}

const stripeGateway: PaymentGateway = {
  async createCheckoutSession(params, options) {
    return getStripeClient().checkout.sessions.create(params, options);
  },
  async createConnectAccount(params, options) {
    return getStripeClient().accounts.create(params, options);
  },
  async createAccountLink(params) {
    return getStripeClient().accountLinks.create(params);
  },
  async createLoginLink(accountId) {
    return getStripeClient().accounts.createLoginLink(accountId);
  },
  async retrieveAccount(accountId) {
    return getStripeClient().accounts.retrieve(accountId);
  },
};

export function getPaymentGateway(): PaymentGateway {
  return stripeGateway;
}
