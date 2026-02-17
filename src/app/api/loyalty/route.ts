// src/app/api/loyalty/route.ts — Loyalty status API
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// ── GET /api/loyalty?shopId=X — Get loyalty status for user+shop ──
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shopId = req.nextUrl.searchParams.get("shopId");
    if (!shopId) return apiError("VALIDATION_ERROR", "shopId requis");

    const user = await getOrCreateUser(clerkId);
    if (!user) return apiError("UNAUTHORIZED", "Utilisateur introuvable");

    // Get the active loyalty rule for this shop
    const rule = await prisma.loyaltyRule.findFirst({
      where: { shopId, active: true },
    });

    if (!rule) {
      return apiSuccess({ active: false });
    }

    // Get or create loyalty points for this user+shop
    const points = await prisma.loyaltyPoint.upsert({
      where: { userId_shopId: { userId: user.id, shopId } },
      create: { userId: user.id, shopId, orderCount: 0, rewardsEarned: 0 },
      update: {},
    });

    const remaining = rule.ordersRequired - (points.orderCount % rule.ordersRequired);

    return apiSuccess({
      active: true,
      orderCount: points.orderCount,
      ordersRequired: rule.ordersRequired,
      rewardPct: rule.rewardPct,
      rewardsEarned: points.rewardsEarned,
      remaining: remaining === rule.ordersRequired ? rule.ordersRequired : remaining,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/GET");
  }
}
