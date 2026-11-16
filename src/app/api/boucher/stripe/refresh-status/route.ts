// POST /api/boucher/stripe/refresh-status
//
// Re-reads the butcher's Stripe Connect account and writes its state on the shop
// (syncShopStripeStatus), without waiting for the account.updated webhook: after the return from
// onboarding, or from the « Vérifier mon statut » button.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { syncShopStripeStatus } from "@/lib/services/stripe/connect";

export async function POST() {
  try {
    if (!isStripeConfigured()) {
      return apiError("SERVICE_DISABLED", "Stripe non configuré");
    }

    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const shop = await prisma.shop.findUnique({
      where: { id: auth.shopId },
      select: { stripeAccountId: true },
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

    return apiSuccess(await syncShopStripeStatus(shop.stripeAccountId));
  } catch (err) {
    return handleApiError(err, "boucher/stripe/refresh-status");
  }
}
