// src/app/api/orders/[id]/status/route.ts — Lightweight order status endpoint (for polling)
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerUserId, getBoucherOwnerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * The order as a query condition the caller may read: their own order, or an order of a shop whose
 * ownerId is one of their ids (clerkId or Prisma id; the shop owner in test mode). The ownership is
 * checked by the query, on columns that are not returned.
 */
async function readableOrder(orderId: string, clerkId: string): Promise<Prisma.OrderWhereInput> {
  const [dbUser, testOwner] = await Promise.all([
    prisma.user.findUnique({ where: { clerkId }, select: { id: true } }),
    getBoucherOwnerUserId(),
  ]);
  const ownerIds = [clerkId, dbUser?.id, testOwner].filter(
    (ownerId): ownerId is string => !!ownerId
  );
  return { id: orderId, OR: [{ user: { clerkId } }, { shop: { ownerId: { in: ownerIds } } }] };
}

// ── GET /api/orders/[id]/status ────────────────
// For the customer and the butcher of the shop. An order outside the caller's reach is 404.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findFirst({
      where: await readableOrder(id, userId),
      select: {
        id: true,
        status: true,
        orderNumber: true,
        dailyNumber: true,
        displayNumber: true,
        customerNumber: true,
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
        user: { select: { firstName: true, lastName: true } },
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

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/status/GET");
  }
}
