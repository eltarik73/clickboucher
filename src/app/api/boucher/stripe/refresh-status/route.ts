// POST /api/boucher/stripe/refresh-status
//
// Force la synchronisation de l'état Stripe Connect du boucher.
// Utile :
// - Après retour de l'onboarding (return_url) pour rafraîchir les flags sans attendre le webhook
// - Bouton manuel "Vérifier mon statut" sur le dashboard

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { syncShopStripeStatus } from "@/lib/services/stripe/connect";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    if (!isStripeConfigured()) {
      return apiError("SERVICE_DISABLED", "Stripe non configuré");
    }

    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const shop = await prisma.shop.findUnique({
      where: { id: auth.shopId },
      select: { id: true, stripeAccountId: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }
    if (!shop.stripeAccountId) {
      return apiError(
        "VALIDATION_ERROR",
        "Aucun compte Stripe lié à cette boutique",
      );
    }

    const status = await syncShopStripeStatus(shop.stripeAccountId);

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        stripeAccountStatus: status.status,
        stripeChargesEnabled: status.chargesEnabled,
        stripePayoutsEnabled: status.payoutsEnabled,
      },
    });

    logger.info("[boucher/stripe/refresh-status] synced", {
      shopId: shop.id,
      status: status.status,
    });

    return apiSuccess({
      accountId: status.accountId,
      status: status.status,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      requirementsCurrentlyDue: status.requirementsCurrentlyDue,
      requirementsPastDue: status.requirementsPastDue,
    });
  } catch (err) {
    return handleApiError(err, "boucher/stripe/refresh-status");
  }
}
