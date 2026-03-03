// src/app/api/checkout/validate-code/route.ts — Validate promo code at checkout
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { validatePromoCode } from "@/lib/marketing/validate-code";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/validate-code
 * Validates a promo/loyalty code against the current cart
 * Body: { code: string, cartTotal: number, cartProductIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Non authentifié");
    }

    // Resolve Clerk ID to Prisma user ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    const userId = dbUser?.id || clerkId;

    const body = await req.json();
    const { code, cartTotal, cartProductIds } = body;

    if (!code || typeof code !== "string") {
      return apiError("VALIDATION_ERROR", "Code promo requis");
    }
    if (typeof cartTotal !== "number" || cartTotal < 0) {
      return apiError("VALIDATION_ERROR", "Montant du panier invalide");
    }
    if (!Array.isArray(cartProductIds)) {
      return apiError("VALIDATION_ERROR", "Liste des produits requise");
    }

    const result = await validatePromoCode({
      code,
      userId,
      cartTotal,
      cartProductIds,
    });

    if (!result.valid) {
      return apiError("VALIDATION_ERROR", result.error);
    }

    return apiSuccess({
      valid: true,
      offer: {
        id: result.offer.id,
        name: result.offer.name,
        code: result.offer.code,
        type: result.offer.type,
        discountValue: result.offer.discountValue,
        payer: result.offer.payer,
      },
      discount: result.discount,
      freeProductId: result.freeProductId ?? null,
    });
  } catch (error) {
    return handleApiError(error, "checkout/validate-code POST");
  }
}
