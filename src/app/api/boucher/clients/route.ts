import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin, isBoucher } from "@/lib/roles";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const { userId: clerkId, sessionClaims } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const role = (sessionClaims?.metadata as Record<string, string> | undefined)?.role;
    if (!isBoucher(role) && !isAdmin(role)) {
      return apiError("FORBIDDEN", "Accès refusé");
    }

    // Get the shop owned by this user
    const shop = await prisma.shop.findFirst({
      where: { ownerId: clerkId },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Aucune boucherie trouvée");
    }

    // 1. Aggregate orders by userId in DB (count, sum, max date)
    const aggregated = await prisma.order.groupBy({
      by: ["userId"],
      where: { shopId: shop.id },
      _count: { _all: true },
      _sum: { totalCents: true },
      _max: { createdAt: true },
      orderBy: { _count: { userId: "desc" } },
      take: 50,
    });

    if (aggregated.length === 0) {
      return apiSuccess([]);
    }

    const clientIds = aggregated.map((a) => a.userId);

    // 2. Fetch user info + proAccess in parallel
    const [users, proAccesses] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
      prisma.proAccess.findMany({
        where: {
          userId: { in: clientIds },
          shopId: shop.id,
        },
        select: {
          userId: true,
          status: true,
          companyName: true,
        },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const proAccessMap = new Map(proAccesses.map((pa) => [pa.userId, pa]));

    // 3. Assemble final list (already sorted by orderCount desc from groupBy)
    const clients = aggregated.map((agg) => {
      const user = userMap.get(agg.userId);
      const proAccess = proAccessMap.get(agg.userId);
      return {
        userId: agg.userId,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        email: user?.email ?? "",
        orderCount: agg._count._all,
        totalSpent: agg._sum.totalCents || 0,
        lastOrderDate: agg._max.createdAt,
        proStatus: proAccess?.status ?? null,
        companyName: proAccess?.companyName ?? null,
      };
    });

    return apiSuccess(clients);
  } catch (error) {
    return handleApiError(error, "boucher-clients");
  }
}
