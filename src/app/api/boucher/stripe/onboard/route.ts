// GET /api/boucher/stripe/onboard
//
// Démarre (ou reprend) l'onboarding Stripe Connect Express pour le boucher courant.
// - Si Shop.stripeAccountId est null → crée un compte Express → persist → redirige onboarding
// - Sinon → regénère un Account Link sur le compte existant
//
// Réponse : { url: string } — le client appelle window.location = url

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import {
  getOrCreateConnectAccount,
  createOnboardingLink,
} from "@/lib/services/stripe/connect";

export async function GET(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return apiError("SERVICE_DISABLED", "Stripe non configuré");
    }

    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { shopId } = auth;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeAccountId: true,
      },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }

    if (!shop.email) {
      return apiError(
        "VALIDATION_ERROR",
        "Email boutique requis pour l'onboarding Stripe — renseignez-le dans les paramètres",
      );
    }

    // Get-or-create idempotent — protège contre la double-création (audit C1 + F-08).
    // Idempotency Stripe + re-check optimiste DB : double-clic / retry réseau ne
    // crée jamais deux comptes Express orphelins.
    const { accountId, created } = await getOrCreateConnectAccount({
      shopId: shop.id,
      email: shop.email,
      businessName: shop.name,
    });

    if (created) {
      logger.info("[boucher/stripe/onboard] account created", {
        shopId: shop.id,
        accountId,
      });
    }

    // URLs de retour — on récupère SITE_URL ou on retombe sur l'origine de la requête
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;
    const returnUrl = `${siteUrl}/boucher/parametres/paiement?stripe=return`;
    const refreshUrl = `${siteUrl}/boucher/parametres/paiement?stripe=refresh`;

    const link = await createOnboardingLink({
      accountId,
      returnUrl,
      refreshUrl,
    });

    return apiSuccess({ url: link.url, accountId });
  } catch (err) {
    return handleApiError(err, "boucher/stripe/onboard");
  }
}
