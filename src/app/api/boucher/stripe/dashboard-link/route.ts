// GET /api/boucher/stripe/dashboard-link
//
// Génère un Login Link vers le dashboard Stripe Express du boucher.
// Utilisé depuis /boucher/dashboard/finances ou /paiement pour ouvrir le
// dashboard Stripe natif (payouts, KYC, factures, fiscalité).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { createLoginLink } from "@/lib/services/stripe/connect";

export async function GET() {
  try {
    if (!isStripeConfigured()) {
      return apiError("SERVICE_DISABLED", "Stripe non configuré");
    }

    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const shop = await prisma.shop.findUnique({
      where: { id: auth.shopId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }
    if (!shop.stripeAccountId) {
      return apiError(
        "VALIDATION_ERROR",
        "Compte Stripe non connecté — démarrez d'abord l'onboarding",
      );
    }

    const link = await createLoginLink(shop.stripeAccountId);
    return apiSuccess({ url: link.url });
  } catch (err) {
    return handleApiError(err, "boucher/stripe/dashboard-link");
  }
}
