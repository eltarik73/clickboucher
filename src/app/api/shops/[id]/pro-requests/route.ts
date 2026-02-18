import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId, sessionClaims } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;
    const role = (sessionClaims?.metadata as Record<string, string> | undefined)?.role;

    // Verify user is shop owner or admin
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    if (shop.ownerId !== clerkId && role !== "admin") {
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

    // For each request, count orders at this shop
    const enrichedRequests = await Promise.all(
      proRequests.map(async (request) => {
        const orderCount = await prisma.order.count({
          where: { userId: request.user.id, shopId },
        });
        return { ...request, orderCount };
      })
    );

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
