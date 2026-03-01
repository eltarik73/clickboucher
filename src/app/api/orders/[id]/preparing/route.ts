export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const preparingSchema = z.object({
  addMinutes: z.number().int().min(0).max(120).optional(),
});

// ── POST /api/orders/[id]/preparing ──────────
// Boucher (owner) — transition ACCEPTED → PREPARING, optionally add extra time
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        estimatedReady: true,
        shopId: true,
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shopId !== shopId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }
    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError(
        "VALIDATION_ERROR",
        `Impossible de passer en préparation une commande en statut ${order.status}`
      );
    }

    const body = await req.json().catch(() => ({}));
    const { addMinutes } = preparingSchema.parse(body);

    const data: { status: OrderStatus; estimatedReady?: Date } = {
      status: "PREPARING" as OrderStatus,
    };

    if (addMinutes && addMinutes > 0) {
      const base = order.estimatedReady ? new Date(order.estimatedReady) : new Date();
      data.estimatedReady = new Date(base.getTime() + addMinutes * 60_000);
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: { items: { include: { product: true } } },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
