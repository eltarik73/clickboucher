// src/lib/services/stripe/connect.ts
//
// Stripe Connect Express onboarding for bouchers.
//
// Flow :
// 1. Le boucher clique "Connecter Stripe" → /api/boucher/stripe/onboard
//    → createConnectAccount() → persist Shop.stripeAccountId
//    → createOnboardingLink() → redirect vers Stripe-hosted KYC
// 2. Stripe redirige vers `return_url` après KYC
// 3. Webhook `account.updated` met à jour `chargesEnabled` / `payoutsEnabled`
// 4. Tant que `chargesEnabled !== true`, le boucher ne peut pas activer
//    le paiement en ligne (acceptOnline forcé à false côté UI).
//
// Country = FR uniquement (marketplace France).
// Business type = "individual" par défaut (auto-entrepreneur boucher).
//   À adapter via UI si SARL/SAS — Stripe accepte le re-onboarding.

import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";

export type ConnectAccountInput = {
  email: string;
  businessName: string;
  shopId: string;
  /** "individual" pour auto-entrepreneur, "company" pour SARL/SAS. Défaut "individual". */
  businessType?: "individual" | "company";
};

/**
 * Crée un compte Stripe Connect Express pour un boucher.
 * Idempotent au sens Stripe — on doit cependant vérifier que `Shop.stripeAccountId`
 * est null AVANT d'appeler cette fonction (sinon on crée des comptes orphelins).
 */
export async function createConnectAccount(
  input: ConnectAccountInput,
): Promise<Stripe.Account> {
  const stripe = getStripeClient();
  return await stripe.accounts.create({
    type: "express",
    country: "FR",
    email: input.email,
    business_type: input.businessType ?? "individual",
    business_profile: {
      name: input.businessName,
      mcc: "5499", // Misc & Specialty Retail Stores (food)
      product_description: "Boucherie halal click & collect",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { shopId: input.shopId },
    settings: {
      payouts: {
        schedule: { interval: "weekly", weekly_anchor: "monday" },
      },
    },
  });
}

/**
 * Génère un Account Link pour démarrer ou reprendre le KYC.
 * Account Links expirent en quelques minutes — toujours regénérer à chaque clic.
 */
export async function createOnboardingLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<Stripe.AccountLink> {
  const stripe = getStripeClient();
  return await stripe.accountLinks.create({
    account: params.accountId,
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
    type: "account_onboarding",
  });
}

/**
 * Génère un Login Link vers le dashboard Stripe Express du boucher.
 * Utilisé depuis /boucher/dashboard/finances pour voir payouts, KYC, fiscal.
 */
export async function createLoginLink(
  accountId: string,
): Promise<Stripe.LoginLink> {
  const stripe = getStripeClient();
  return await stripe.accounts.createLoginLink(accountId);
}

/**
 * Récupère l'état d'un compte Stripe Connect.
 * Utilisé par /api/boucher/stripe/refresh-status (manuel) et par le webhook
 * `account.updated` pour synchroniser les flags Shop.stripeChargesEnabled etc.
 */
export type ConnectAccountStatus = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: "active" | "pending" | "restricted";
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
};

export async function syncShopStripeStatus(
  accountId: string,
): Promise<ConnectAccountStatus> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(accountId);

  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const detailsSubmitted = account.details_submitted ?? false;
  const requirements = account.requirements;
  const pastDue = requirements?.past_due ?? [];

  // Status logic :
  // - "active" : tout vert, le boucher peut encaisser
  // - "restricted" : Stripe a bloqué (KYC en retard, fonds gelés)
  // - "pending" : KYC en cours ou pas démarré
  let status: ConnectAccountStatus["status"];
  if (chargesEnabled && payoutsEnabled) {
    status = "active";
  } else if (pastDue.length > 0 || requirements?.disabled_reason) {
    status = "restricted";
  } else {
    status = "pending";
  }

  return {
    accountId: account.id,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    status,
    requirementsCurrentlyDue: requirements?.currently_due ?? [],
    requirementsPastDue: pastDue,
  };
}
