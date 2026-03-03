// POST /api/promo-codes/validate — Unified promo code validation
// Checks: PromoCode (new unified system) → Promotion (legacy) → LoyaltyReward
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
  shopId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Resolve Clerk ID → Prisma user ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, totalOrders: true, role: true, createdAt: true },
    });
    const userId = dbUser?.id || clerkId;

    const body = await req.json();
    const { code, orderTotalCents, shopId } = schema.parse(body);
    const normalizedCode = code.toUpperCase().trim();

    // ══════════════════════════════════════════
    // 1. Try as PromoCode (new unified system)
    // ══════════════════════════════════════════
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: normalizedCode },
    });

    if (promoCode) {
      // Status check
      if (promoCode.status !== "ACTIVE") {
        return apiSuccess({ valid: false, error: "Ce code n'est plus actif" });
      }

      // Date check
      const now = new Date();
      if (now < promoCode.startsAt) {
        return apiSuccess({ valid: false, error: "Ce code n'est pas encore valide" });
      }
      if (now > promoCode.endsAt) {
        return apiSuccess({ valid: false, error: "Ce code a expiré" });
      }

      // Scope check — SHOP promos only work for that shop
      if (promoCode.scope === "SHOP" && promoCode.shopId && shopId && promoCode.shopId !== shopId) {
        return apiSuccess({ valid: false, error: "Ce code n'est pas valable pour cette boutique" });
      }

      // Max global uses
      if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
        return apiSuccess({ valid: false, error: "Ce code a atteint sa limite d'utilisation" });
      }

      // Per-user limit
      if (promoCode.maxUsesPerUser > 0) {
        const userUses = await prisma.promoCodeUsage.count({
          where: { promoCodeId: promoCode.id, userId },
        });
        if (userUses >= promoCode.maxUsesPerUser) {
          return apiSuccess({ valid: false, error: "Vous avez déjà utilisé ce code" });
        }
      }

      // Audience check
      if (dbUser && promoCode.audience !== "ALL") {
        const audienceValid = checkAudience(promoCode.audience, dbUser);
        if (!audienceValid) {
          return apiSuccess({ valid: false, error: "Ce code n'est pas disponible pour votre profil" });
        }
      }

      // Min order check
      if (promoCode.minOrderCents && orderTotalCents < promoCode.minOrderCents) {
        const minEur = (promoCode.minOrderCents / 100).toFixed(2).replace(".", ",");
        return apiSuccess({
          valid: false,
          error: `Commande minimum de ${minEur} € requise`,
        });
      }

      // Calculate discount
      let discountCents = 0;
      let offerType: string = promoCode.discountType;
      let eligibleProductIds: string[] = [];

      if (promoCode.discountType === "FIXED" && promoCode.valueCents) {
        discountCents = Math.min(promoCode.valueCents, orderTotalCents);
      } else if (promoCode.discountType === "PERCENT" && promoCode.valuePercent) {
        discountCents = Math.round(orderTotalCents * (promoCode.valuePercent / 100));
        if (promoCode.maxDiscountCents && discountCents > promoCode.maxDiscountCents) {
          discountCents = promoCode.maxDiscountCents;
        }
      } else if (promoCode.discountType === "BOGO" || promoCode.discountType === "BUNDLE") {
        // BOGO/BUNDLE: discount calculated at checkout based on eligible products in cart
        // For validation, just confirm the offer is valid and return eligible product IDs
        const eligibleProducts = await prisma.offerProduct.findMany({
          where: { promoCodeId: promoCode.id },
          select: { productId: true },
        });
        eligibleProductIds = eligibleProducts.map((p) => p.productId);
        offerType = promoCode.discountType;
      }
      // FREE_FEES: discountCents stays 0, handled at checkout level

      return apiSuccess({
        valid: true,
        discountCents,
        promoCodeId: promoCode.id,
        source: promoCode.scope,
        label: promoCode.label,
        type: offerType,
        isFlash: promoCode.isFlash,
        ...(eligibleProductIds.length > 0 && { eligibleProductIds }),
      });
    }

    // ══════════════════════════════════════════
    // 2. Try as legacy Promotion code
    // ══════════════════════════════════════════
    const promo = await prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (promo) {
      if (!promo.isActive) return apiSuccess({ valid: false, error: "Ce code n'est plus actif" });
      if (new Date() < promo.startsAt) return apiSuccess({ valid: false, error: "Ce code n'est pas encore valide" });
      if (new Date() > promo.endsAt) return apiSuccess({ valid: false, error: "Ce code a expiré" });
      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        return apiSuccess({ valid: false, error: "Ce code a atteint sa limite d'utilisation" });
      }

      if (promo.maxUsesPerUser > 0) {
        const userUses = await prisma.order.count({
          where: { userId, promotionId: promo.id },
        });
        if (userUses >= promo.maxUsesPerUser) {
          return apiSuccess({ valid: false, error: "Vous avez déjà utilisé ce code" });
        }
      }

      if (promo.minOrderCents && orderTotalCents < promo.minOrderCents) {
        const minEur = (promo.minOrderCents / 100).toFixed(2).replace(".", ",");
        return apiSuccess({ valid: false, error: `Commande minimum de ${minEur} € requise` });
      }

      let discountCents = 0;
      if (promo.type === "FIXED" && promo.valueCents) {
        discountCents = Math.min(promo.valueCents, orderTotalCents);
      } else if (promo.type === "PERCENT" && promo.valuePercent) {
        discountCents = Math.round(orderTotalCents * (promo.valuePercent / 100));
      }

      return apiSuccess({
        valid: true,
        discountCents,
        promotionId: promo.id,
        source: promo.source,
        label: promo.label,
        type: promo.type,
      });
    }

    // ══════════════════════════════════════════
    // 3. Try as Loyalty reward code
    // ══════════════════════════════════════════
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
    return handleApiError(error, "promo-codes/validate/POST");
  }
}

// ── Audience validation helper ──
function checkAudience(
  audience: string,
  user: { totalOrders: number; role: string; createdAt: Date }
): boolean {
  switch (audience) {
    case "NEW_CLIENTS":
      return user.totalOrders <= 1;
    case "LOYAL_CLIENTS":
      return user.totalOrders >= 5;
    case "INACTIVE_CLIENTS": {
      // Inactive = no order in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return user.createdAt < thirtyDaysAgo;
    }
    case "PRO_CLIENTS":
      return user.role === "CLIENT_PRO";
    default:
      return true;
  }
}
