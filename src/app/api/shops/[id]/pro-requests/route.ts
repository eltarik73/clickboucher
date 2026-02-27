import { getServerUserId } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;
    const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true, role: true } });

    // Verify user is shop owner or admin
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    if (shop.ownerId !== clerkId && shop.ownerId !== dbUser?.id && !isAdmin(dbUser?.role)) {
      return apiError("FORBIDDEN", "Accès refusé");
    }

    // Get all ProAccess for this shop with user info
    const proRequests = await prisma.proAccess.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    // Batch: count orders per user in a single groupBy query
    const userIds = proRequests.map((r) => r.user.id);
    const orderCounts = await prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, shopId },
      _count: { _all: true },
    });
    const orderCountMap = new Map(
      orderCounts.map((oc) => [oc.userId, oc._count._all])
    );

    const enrichedRequests = proRequests.map((request) => ({
      ...request,
      orderCount: orderCountMap.get(request.user.id) || 0,
    }));

    // Sort: PENDING first, then APPROVED, then REJECTED
    const statusOrder: Record<string, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
    enrichedRequests.sort(
      (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    );

    return apiSuccess(enrichedRequests);
  } catch (error) {
    return handleApiError(error, "pro-requests");
  }
}
