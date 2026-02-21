// src/app/api/orders/[id]/status/route.ts — Lightweight order status endpoint (for polling)
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Permission: client owner or shop owner
    if (order.user.clerkId !== userId) {
      const shop = await prisma.shop.findUnique({
        where: { id: order.shop.id },
        select: { ownerId: true },
      });
      if (shop?.ownerId !== userId) {
        return apiError("FORBIDDEN", "Accès refusé");
      }
    }

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/status/GET");
  }
}
