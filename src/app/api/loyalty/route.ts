// GET /api/loyalty?shopId=... — Loyalty status for current user at a shop
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { getServerUserId } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  shopId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { shopId } = querySchema.parse({
      shopId: searchParams.get("shopId") || undefined,
    });

    if (!shopId) return apiSuccess({ active: false });

    const clerkId = await getServerUserId();
    if (!clerkId) return apiSuccess({ active: false });

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) return apiSuccess({ active: false });

    const rule = await prisma.loyaltyRule.findFirst({
      where: { shopId },
      select: { ordersRequired: true, rewardPct: true, active: true },
    });

    if (!rule || !rule.active) return apiSuccess({ active: false });

    const [orderCount, rewardsEarned] = await Promise.all([
      prisma.order.count({
        where: { userId: dbUser.id, shopId, status: "COMPLETED" },
      }),
      prisma.loyaltyReward.count({
        where: { userId: dbUser.id },
      }),
    ]);

    const ordersRequired = rule.ordersRequired;
    const modulo = ordersRequired > 0 ? orderCount % ordersRequired : 0;
    const remaining = Math.max(0, ordersRequired - modulo);

    return apiSuccess({
      active: true,
      orderCount,
      ordersRequired,
      rewardPct: rule.rewardPct,
      rewardsEarned,
      remaining,
    });
  } catch (error) {
    return handleApiError(error, "loyalty/get");
  }
}
