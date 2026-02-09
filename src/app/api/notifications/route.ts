import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/notifications ───────────────────
// Returns recent order status changes for the current user
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Find internal user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // Orders with a status change in the last 24h
    const since = new Date(Date.now() - 24 * 60 * 60_000);

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        updatedAt: { gte: since },
        status: {
          in: [
            "ACCEPTED",
            "DENIED",
            "READY",
            "PICKED_UP",
            "PARTIALLY_DENIED",
            "PREPARING",
          ],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
        shop: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const notifications = orders.map((order) => ({
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      shopName: order.shop.name,
      updatedAt: order.updatedAt.toISOString(),
    }));

    return apiSuccess(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
