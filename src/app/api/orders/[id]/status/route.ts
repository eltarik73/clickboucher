// src/app/api/orders/[id]/status/route.ts — Lightweight order status endpoint (for polling)
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        dailyNumber: true,
        displayNumber: true,
        estimatedReady: true,
        actualReady: true,
        pickedUpAt: true,
        qrCode: true,
        totalCents: true,
        denyReason: true,
        boucherNote: true,
        customerNote: true,
        rating: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unit: true,
            priceCents: true,
            totalCents: true,
            available: true,
            replacement: true,
            weightGrams: true,
          },
        },
        shop: { select: { id: true, name: true, phone: true, address: true, city: true } },
        user: { select: { clerkId: true, firstName: true, lastName: true, customerNumber: true } },
        priceAdjustment: {
          select: {
            id: true,
            originalTotal: true,
            newTotal: true,
            reason: true,
            adjustmentType: true,
            status: true,
            tier: true,
            autoApproveAt: true,
            escalateAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Permission: client owner or shop owner
    if (order.user.clerkId !== userId) {
      // Check shop ownership with OR clause (ownerId may store clerkId OR dbUser.id)
      const [shop, dbUser] = await Promise.all([
        prisma.shop.findUnique({
          where: { id: order.shop.id },
          select: { ownerId: true },
        }),
        prisma.user.findUnique({
          where: { clerkId: userId },
          select: { id: true },
        }),
      ]);
      if (shop?.ownerId !== userId && shop?.ownerId !== dbUser?.id) {
        return apiError("FORBIDDEN", "Accès refusé");
      }
    }

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/status/GET");
  }
}
