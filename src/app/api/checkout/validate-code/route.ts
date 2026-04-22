// src/app/api/checkout/validate-code/route.ts — Validate promo code at checkout
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { validatePromoCode } from "@/lib/marketing/validate-code";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const validateCheckoutCodeSchema = z.object({
  code: z.string().min(1).max(50),
  cartTotal: z.number().min(0),
  cartProductIds: z.array(z.string()),
});

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

    const rl = await checkRateLimit(rateLimits.promoValidate, `promo:${clerkId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de tentatives, réessayez dans une minute");
    }

    // Resolve Clerk ID to Prisma user ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    const userId = dbUser?.id || clerkId;

    const parsed = validateCheckoutCodeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides");
    }
    const { code, cartTotal, cartProductIds } = parsed.data;

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
