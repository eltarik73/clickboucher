// src/app/api/offers/validate/route.ts — Validate promo/loyalty code from panier
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { validatePromoCode } from "@/lib/marketing/validate-code";
import { z } from "zod";

const validateCodeSchema = z.object({
  code: z.string().min(1).max(50),
  orderTotalCents: z.number().int().min(0).optional(),
  shopId: z.string().min(1).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Non authentifié");
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    const userId = dbUser?.id || clerkId;

    const body = await req.json();
    const parsed = validateCodeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Code promo requis");
    }
    const { code, orderTotalCents, shopId } = parsed.data;

    const trimmedCode = code.trim().toUpperCase();

    // 1. Try as Offer/PromoCode
    const cartProductIds: string[] = [];
    if (shopId) {
      const cartItems = await prisma.cartItem.findMany({
        where: { cart: { userId, shopId } },
        select: { productId: true },
      });
      cartProductIds.push(...cartItems.map((ci) => ci.productId));
    }

    const result = await validatePromoCode({
      code: trimmedCode,
      userId,
      cartTotal: (orderTotalCents || 0) / 100,
      cartProductIds,
    });

    if (result.valid) {
      const discountCents = Math.round(result.discount * 100);
      return apiSuccess({
        valid: true,
        discountCents,
        offerId: result.offer.id,
        loyaltyRewardId: null,
        source: "OFFER",
        label: result.offer.name,
        type: result.offer.type,
      });
    }

    // 2. Try as LoyaltyReward
    const reward = await prisma.loyaltyReward.findFirst({
      where: {
        code: trimmedCode,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (reward) {
      const discountCents = reward.rewardType === "FIXED"
        ? (reward.rewardCents ?? 0)
        : Math.round(((orderTotalCents || 0) * (reward.rewardPercent ?? 0)) / 100);

      return apiSuccess({
        valid: true,
        discountCents,
        offerId: null,
        loyaltyRewardId: reward.id,
        source: "LOYALTY",
        label: `Fidélité -${reward.rewardType === "FIXED" ? ((reward.rewardCents ?? 0) / 100).toFixed(0) + "\u20AC" : (reward.rewardPercent ?? 0) + "%"}`,
        type: reward.rewardType,
      });
    }

    // 3. Nothing found
    return apiSuccess({
      valid: false,
      error: result.valid === false ? result.error : "Code invalide",
    });
  } catch (error) {
    return handleApiError(error, "offers/validate POST");
  }
}
