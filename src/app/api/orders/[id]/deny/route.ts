import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { denyOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";

// ── POST /api/orders/[id]/deny ─────────────────
// Boucher (owner) — deny an order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
