// src/app/api/boucher/orders/pickup/route.ts — QR-code-based pickup confirmation
// Looks up order by qrCode server-side (no need to fetch all orders client-side)
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pickupByQrSchema = z.object({
  qrCode: z.string().uuid("QR code invalide"),
});

// ── POST /api/boucher/orders/pickup ──────────────
// Boucher scans QR code -> finds order -> marks as PICKED_UP
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = pickupByQrSchema.parse(body);

    // Find the order by QR code
    const order = await prisma.order.findFirst({
      where: { qrCode: data.qrCode },
      select: {
        id: true,
        status: true,
        qrCode: true,
        userId: true,
        orderNumber: true,
        totalCents: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
          },
        },
        user: { select: { firstName: true, lastName: true } },
        shop: { select: { id: true, ownerId: true, name: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Aucune commande trouvee avec ce QR code");
    }

    // Verify the boucher owns this shop
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas a votre boucherie");
    }

    // Verify order is READY
    if (order.status !== "READY") {
      const statusMessages: Record<string, string> = {
        PENDING: "La commande n'a pas encore ete acceptee",
        ACCEPTED: "La commande est acceptee mais pas encore prete",
        PREPARING: "La commande est encore en preparation",
        PICKED_UP: "La commande a deja ete recuperee",
        COMPLETED: "La commande est deja terminee",
        DENIED: "La commande a ete refusee",
        CANCELLED: "La commande a ete annulee",
        AUTO_CANCELLED: "La commande a expire",
      };
      return apiError(
        "VALIDATION_ERROR",
        statusMessages[order.status] || `La commande n'est pas prete (statut: ${order.status})`
      );
    }

    // Mark as picked up
    const now = new Date();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PICKED_UP", pickedUpAt: now, qrScannedAt: now },
    });

    // Notify client
    await sendNotification("ORDER_PICKED_UP", {
      userId: order.userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    });

    const clientName = order.user
      ? `${order.user.firstName} ${order.user.lastName}`.trim()
      : "Client";

    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

    return apiSuccess({
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientName,
      itemCount,
      totalCents: order.totalCents,
    });
  } catch (error) {
    return handleApiError(error, "boucher/orders/pickup");
  }
}
