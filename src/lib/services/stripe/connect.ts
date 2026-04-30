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
import prisma from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export type ConnectAccountInput = {
  email: string;
  businessName: string;
  shopId: string;
  /** "individual" pour auto-entrepreneur, "company" pour SARL/SAS. Défaut "individual". */
  businessType?: "individual" | "company";
};

/**
 * Crée un compte Stripe Connect Express pour un boucher.
 *
 * ⚠️ FIX AUDIT C1 — `idempotencyKey: shop:create-account:${shopId}` est passé à Stripe.
 * Stripe dédupe pendant 24h sur cette clé : un double-clic du boucher ou un retry réseau
 * ne crée PAS un second compte. Sans ça, deux comptes Express orphelins étaient créés
 * (et seul le second persisté → le premier reste facturé chez Stripe).
 *
 * Pour la sécurité COMPLÈTE contre la race lors du persist DB, utiliser plutôt
 * `getOrCreateConnectAccount()` qui combine idempotency Stripe + lock applicatif Prisma.
 */
export async function createConnectAccount(
  input: ConnectAccountInput,
): Promise<Stripe.Account> {
  const stripe = getStripeClient();
  return await stripe.accounts.create(
    {
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
    },
    {
      // Stripe dédupe 24h — anti double-création sur double-clic / retry réseau (audit C1)
      idempotencyKey: `shop:create-account:${input.shopId}`,
    },
  );
}

/**
 * Get-or-create idempotent du compte Stripe Connect d'un shop.
 *
 * ⚠️ FIX AUDIT C1 (race double-création) — combine deux protections :
 *   1. Idempotency Stripe-side (`shop:create-account:${shopId}` 24h dédupe)
 *   2. Re-lecture du shop juste avant l'update + check `stripeAccountId !== null`
 *      (race-detection optimiste). Si une autre requête concurrente a déjà persisté
 *      un accountId entre notre 1er findUnique et notre create, on retourne celui-là
 *      (l'idempotency Stripe garantit que les deux create renvoient le MÊME compte).
 *
 * Pourquoi pas `prisma.$transaction` avec `SELECT ... FOR UPDATE` ?
 *   Prisma ne supporte pas les locks row-level explicites en mode pgbouncer (notre
 *   config Vercel). L'idempotency Stripe + le re-check au moment de l'update est la
 *   garantie la plus simple et correcte ici.
 *
 * @returns { accountId, created } — `created=true` si on vient de créer le compte
 */
export async function getOrCreateConnectAccount(input: {
  shopId: string;
  email: string;
  businessName: string;
  businessType?: "individual" | "company";
}): Promise<{ accountId: string; created: boolean }> {
  // 1. Premier check : compte déjà persisté ?
  const initialShop = await prisma.shop.findUnique({
    where: { id: input.shopId },
    select: { stripeAccountId: true },
  });
  if (!initialShop) {
    throw new Error(`Shop ${input.shopId} not found`);
  }
  if (initialShop.stripeAccountId) {
    return { accountId: initialShop.stripeAccountId, created: false };
  }

  // 2. Pas encore de compte → on en crée un (idempotent côté Stripe)
  const account = await createConnectAccount({
    shopId: input.shopId,
    email: input.email,
    businessName: input.businessName,
    businessType: input.businessType,
  });

  // 3. Re-check après création : une autre requête a-t-elle déjà persisté un accountId ?
  //    Si oui → on retourne celui-là (l'idempotency Stripe garantit que c'est le MÊME).
  //    Note : pas besoin d'updater car la valeur est identique côté Stripe.
  const updateResult = await prisma.shop.updateMany({
    where: {
      id: input.shopId,
      // Garde-fou : on ne persist QUE si l'autre requête n'a pas encore écrit
      stripeAccountId: null,
    },
    data: {
      stripeAccountId: account.id,
      stripeAccountStatus: "pending",
    },
  });

  if (updateResult.count === 0) {
    // Une requête concurrente a gagné la course — on relit pour récupérer son accountId
    const finalShop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: { stripeAccountId: true },
    });
    if (finalShop?.stripeAccountId) {
      // Grâce à l'idempotency Stripe, c'est le même compte que `account.id`
      logger.info("[stripe/connect] race detected, using concurrent accountId", {
        shopId: input.shopId,
        accountId: finalShop.stripeAccountId,
        ourAccountId: account.id,
      });
      return { accountId: finalShop.stripeAccountId, created: false };
    }
    // Cas pathologique (shop disparu entre temps) — fallback sur ce qu'on a
    return { accountId: account.id, created: true };
  }

  logger.info("[stripe/connect] account created", {
    shopId: input.shopId,
    accountId: account.id,
  });
  return { accountId: account.id, created: true };
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
