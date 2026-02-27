export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";

// ── POST /api/orders/[id]/adjustment/reject ──
// Client rejects a price adjustment
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: orderId } = params;
    const userId = await getServerUserId();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, clerkId: true } },
        shop: { select: { id: true, ownerId: true, name: true } },
        priceAdjustment: true,
      },
    });

    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.user.clerkId !== userId) return apiError("FORBIDDEN", "Pas votre commande");

    if (!order.priceAdjustment || order.priceAdjustment.status !== "PENDING") {
      return apiError("VALIDATION_ERROR", "Aucun ajustement en attente");
    }

    const updatedAdj = await prisma.priceAdjustment.update({
      where: { id: order.priceAdjustment.id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    // Notify boucher
    try {
      await sendNotification("PRICE_ADJUSTMENT_REJECTED", {
        shopId: order.shop.id,
        orderId,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
      });
    } catch { /* non-blocking */ }

    return apiSuccess(updatedAdj);
  } catch (error) {
    return handleApiError(error, "orders/adjustment/reject");
  }
}
