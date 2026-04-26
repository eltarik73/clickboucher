export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { acceptOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

// ── POST /api/orders/[id]/accept ───────────────
// Boucher (owner) — accept an order
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-accept:${shopId}`);
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
    // Idempotency: if already accepted, return current state
    if (order.status === "ACCEPTED" || order.status === "PREPARING" || order.status === "READY") {
      const existing = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      return apiSuccess(existing);
    }
    if (order.status !== "PENDING") {
      return apiError("VALIDATION_ERROR", `Impossible d'accepter une commande en statut ${order.status}`);
    }

    const body = await req.json();
    const data = acceptOrderSchema.parse(body);

    const estimatedReady = new Date(Date.now() + data.estimatedMinutes * 60_000);
    const qrCode = randomUUID();

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        estimatedReady,
        qrCode,
      },
      include: { items: true },
    });

    // Notify client
    await sendNotification("ORDER_ACCEPTED", {
      userId: order.userId,
      orderId: id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      estimatedMinutes: data.estimatedMinutes,
      qrCode,
    });

    return apiSuccess({
      ...updated,
      qrCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
