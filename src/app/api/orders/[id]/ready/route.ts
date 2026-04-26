export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

// ── POST /api/orders/[id]/ready ────────────────
// Boucher (owner) — mark order as ready for pickup
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-ready:${shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const order = await prisma.order.findUnique({
      where: { id },
      select: { status: true, userId: true, orderNumber: true, shopId: true, shop: { select: { name: true } } },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shopId !== shopId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }
    // Idempotency: if already ready or beyond, return current state
    if (order.status === "READY" || order.status === "PICKED_UP") {
      const existing = await prisma.order.findUnique({ where: { id } });
      return apiSuccess(existing);
    }
    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError("VALIDATION_ERROR", `Impossible de marquer prêt une commande en statut ${order.status}`);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "READY",
        actualReady: new Date(),
      },
    });

    // Notify client
    await sendNotification("ORDER_READY", {
      userId: order.userId,
      orderId: id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
