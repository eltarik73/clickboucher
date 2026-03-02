// POST /api/promo/validate — Validate a promo code (Promotion or Loyalty)
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { validateLoyaltyCode } from "@/lib/services/loyalty.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1),
  orderTotalCents: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Resolve Clerk ID → Prisma user ID (needed for loyalty rewards)
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    const userId = dbUser?.id || clerkId;

    const body = await req.json();
    const { code, orderTotalCents } = schema.parse(body);

    const normalizedCode = code.toUpperCase().trim();

    // 1. Try as Promotion code
    const promo = await prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (promo) {
      // Validate promotion
      if (!promo.isActive) return apiSuccess({ valid: false, error: "Ce code n'est plus actif" });
      if (new Date() < promo.startsAt) return apiSuccess({ valid: false, error: "Ce code n'est pas encore valide" });
      if (new Date() > promo.endsAt) return apiSuccess({ valid: false, error: "Ce code a expiré" });
      if (promo.maxUses && promo.currentUses >= promo.maxUses) return apiSuccess({ valid: false, error: "Ce code a atteint sa limite d'utilisation" });

      // Check per-user limit
      if (promo.maxUsesPerUser > 0) {
        const userUses = await prisma.order.count({
          where: { userId, promotionId: promo.id },
        });
        if (userUses >= promo.maxUsesPerUser) {
          return apiSuccess({ valid: false, error: "Vous avez déjà utilisé ce code" });
        }
      }

      // Check min order
      if (promo.minOrderCents && orderTotalCents < promo.minOrderCents) {
        const minEur = (promo.minOrderCents / 100).toFixed(2).replace(".", ",");
        return apiSuccess({
          valid: false,
          error: `Commande minimum de ${minEur} € requise`,
        });
      }

      // Calculate discount
      let discountCents = 0;
      if (promo.type === "FIXED" && promo.valueCents) {
        discountCents = Math.min(promo.valueCents, orderTotalCents);
      } else if (promo.type === "PERCENT" && promo.valuePercent) {
        discountCents = Math.round(orderTotalCents * (promo.valuePercent / 100));
      }
      // FREE_FEES: discountCents stays 0, handled at checkout level

      return apiSuccess({
        valid: true,
        discountCents,
        promotionId: promo.id,
        source: promo.source,
        label: promo.label,
        type: promo.type,
      });
    }

    // 2. Try as Loyalty reward code
    const loyaltyResult = await validateLoyaltyCode(normalizedCode, userId, orderTotalCents);
    if (loyaltyResult.valid) {
      return apiSuccess({
        valid: true,
        discountCents: loyaltyResult.discountCents,
        loyaltyRewardId: loyaltyResult.rewardId,
        source: "LOYALTY",
        label: "Bon de fidélité",
        type: "FIXED",
      });
    }

    return apiSuccess({
      valid: false,
      error: loyaltyResult.error || "Code invalide",
    });
  } catch (error) {
    return handleApiError(error, "promo/validate/POST");
  }
}
