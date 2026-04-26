// POST /api/orders/[id]/scheduled-notify — Notify client that boucher starts preparing
// Called by kitchen mode when a scheduled order enters the 30-min preparation window
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        displayNumber: true,
        shopId: true,
        pickupSlotStart: true,
        notifSent: true,
        user: { select: { id: true, clerkId: true } },
        shop: { select: { name: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Must be the same shop
    if (order.shopId !== auth.shopId) {
      return apiError("FORBIDDEN", "Accès refusé");
    }

    // Must be ACCEPTED with pickupSlotStart within next 35 minutes
    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError("VALIDATION_ERROR", "Commande non éligible");
    }

    if (!order.pickupSlotStart) {
      return apiError("VALIDATION_ERROR", "Pas de créneau programmé");
    }

    const msUntilPickup = order.pickupSlotStart.getTime() - Date.now();
    if (msUntilPickup > 35 * 60 * 1000 || msUntilPickup < -5 * 60 * 1000) {
      return apiError("VALIDATION_ERROR", "Créneau hors fenêtre de notification");
    }

    // Check not already notified
    const notifSent: Prisma.JsonValue[] = Array.isArray(order.notifSent) ? order.notifSent : [];
    const alreadySent = notifSent.some(
      (n) =>
        n !== null &&
        typeof n === "object" &&
        !Array.isArray(n) &&
        (n as { event?: string }).event === "SCHEDULED_PREPARE"
    );
    if (alreadySent) {
      return apiSuccess({ notified: false, reason: "already_sent" });
    }

    const pickupTime = order.pickupSlotStart.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Send notification to client
    await sendNotification("PICKUP_SOON", {
      userId: order.user.clerkId ?? order.user.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      estimatedMinutes: Math.max(1, Math.round(msUntilPickup / 60_000)),
      slot: pickupTime,
    });

    // Log in notifSent to prevent duplicates
    await prisma.order.update({
      where: { id: order.id },
      data: {
        notifSent: [
          ...notifSent,
          { event: "SCHEDULED_PREPARE", at: new Date().toISOString() },
        ] as Prisma.InputJsonValue,
      },
    });

    return apiSuccess({ notified: true });
  } catch (error) {
    return handleApiError(error, "orders/scheduled-notify");
  }
}
