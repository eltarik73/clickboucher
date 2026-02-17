export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { pickupOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";

// ── POST /api/orders/[id]/picked-up ────────────
// QR code scan — verify and mark as picked up
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
      select: {
        status: true,
        qrCode: true,
        userId: true,
        orderNumber: true,
        shop: { select: { ownerId: true, name: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }
    if (order.status !== "READY") {
      return apiError("VALIDATION_ERROR", `La commande n'est pas prête (statut: ${order.status})`);
    }

    const body = await req.json();
    const data = pickupOrderSchema.parse(body);

    if (data.qrCode !== order.qrCode) {
      return apiError("VALIDATION_ERROR", "QR code invalide");
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "PICKED_UP",
        pickedUpAt: now,
        qrScannedAt: now,
      },
    });

    // Notify client
    await sendNotification("ORDER_PICKED_UP", {
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
