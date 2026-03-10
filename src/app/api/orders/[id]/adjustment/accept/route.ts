export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";

// ── POST /api/orders/[id]/adjustment/accept ──
// Client accepts a price adjustment
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

    const adj = order.priceAdjustment;

    // Update adjustment + order total in transaction
    const [updatedAdj] = await prisma.$transaction([
      prisma.priceAdjustment.update({
        where: { id: adj.id },
        data: { status: "APPROVED", respondedAt: new Date() },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { totalCents: adj.newTotal },
      }),
    ]);

    // Apply item-level changes from snapshot
    if (adj.itemsSnapshot && Array.isArray(adj.itemsSnapshot)) {
      for (const snap of adj.itemsSnapshot as Record<string, unknown>[]) {
        const updateData: Record<string, unknown> = {};
        if (snap.newQuantity !== undefined) updateData.quantity = snap.newQuantity;
        if (snap.newPriceCents !== undefined) updateData.priceCents = snap.newPriceCents;
        if (snap.newTotalCents !== undefined) updateData.totalCents = snap.newTotalCents;
        if (Object.keys(updateData).length > 0 && snap.orderItemId) {
          await prisma.orderItem.updateMany({
            where: { id: snap.orderItemId as string, orderId },
            data: updateData,
          });
        }
      }
    }

    // Notify boucher
    try {
      await sendNotification("PRICE_ADJUSTMENT_ACCEPTED", {
        shopId: order.shop.id,
        orderId,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
      });
    } catch { /* non-blocking */ }

    return apiSuccess(updatedAdj);
  } catch (error) {
    return handleApiError(error, "orders/adjustment/accept");
  }
}
