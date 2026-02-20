export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { acceptOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";

// ── POST /api/orders/[id]/accept ───────────────
// Boucher (owner) — accept an order
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { status: true, userId: true, orderNumber: true, shop: { select: { ownerId: true, name: true } } },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shop.ownerId !== userId) {
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
