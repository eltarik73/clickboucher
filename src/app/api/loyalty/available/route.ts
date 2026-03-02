// GET /api/loyalty/available — Returns unused, non-expired loyalty rewards for the user
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Resolve Prisma user.id from clerkId
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) return apiSuccess({ rewards: [] });

    const rewards = await prisma.loyaltyReward.findMany({
      where: {
        userId: dbUser.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "asc" },
      select: {
        id: true,
        code: true,
        tier: true,
        rewardType: true,
        rewardCents: true,
        rewardPercent: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return apiSuccess({ rewards });
  } catch (error) {
    return handleApiError(error, "loyalty/available/GET");
  }
}
