export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { denyOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

// ── POST /api/orders/[id]/deny ─────────────────
// Boucher (owner) — deny an order
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-deny:${shopId}`);
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
    // Idempotency: if already denied, return current state
    if (order.status === "DENIED") {
      const existing = await prisma.order.findUnique({ where: { id } });
      return apiSuccess(existing);
    }
    if (order.status !== "PENDING") {
      return apiError("VALIDATION_ERROR", `Impossible de refuser une commande en statut ${order.status}`);
    }

    const body = await req.json();
    const data = denyOrderSchema.parse(body);

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "DENIED",
        denyReason: data.reason,
      },
    });

    // Notify client
    await sendNotification("ORDER_DENIED", {
      userId: order.userId,
      orderId: id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      denyReason: data.reason,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
