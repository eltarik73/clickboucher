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

    // Get all orders for this shop, grouped by user
    const orders = await prisma.order.findMany({
      where: { shopId: shop.id },
      select: {
        userId: true,
        totalCents: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Aggregate by user
    const clientsMap = new Map<
      string,
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        orderCount: number;
        totalSpent: number;
        lastOrderDate: Date;
      }
    >();

    for (const order of orders) {
      const existing = clientsMap.get(order.userId);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += order.totalCents;
        if (order.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = order.createdAt;
        }
      } else {
        clientsMap.set(order.userId, {
          userId: order.user.id,
          firstName: order.user.firstName,
          lastName: order.user.lastName,
          email: order.user.email,
          orderCount: 1,
          totalSpent: order.totalCents,
          lastOrderDate: order.createdAt,
        });
      }
    }

    // Check ProAccess for each client
    const clientIds = Array.from(clientsMap.keys());
    const proAccesses = await prisma.proAccess.findMany({
      where: {
        userId: { in: clientIds },
        shopId: shop.id,
      },
      select: {
        userId: true,
        status: true,
        companyName: true,
      },
    });

    const proAccessMap = new Map(
      proAccesses.map((pa) => [pa.userId, pa])
    );

    // Build final list — flatten proAccess fields
    const clients = Array.from(clientsMap.values()).map((client) => {
      const proAccess = proAccessMap.get(client.userId);
      return {
        ...client,
        proStatus: proAccess?.status ?? null,
        companyName: proAccess?.companyName ?? null,
      };
    });

    // Sort by orderCount desc, take 50
    clients.sort((a, b) => b.orderCount - a.orderCount);
    const paginated = clients.slice(0, 50);

    return apiSuccess(paginated);
  } catch (error) {
    return handleApiError(error, "boucher-clients");
  }
}
