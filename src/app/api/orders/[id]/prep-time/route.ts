export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const prepTimeSchema = z.object({
  prepMinutes: z.number().int().min(1).max(120),
});

// ── PATCH /api/orders/[id]/prep-time ─────────
// Boucher (owner) — adjust preparation time
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userId } = await auth();

    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        shop: { select: { ownerId: true } },
      },
    });

    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }
    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError("VALIDATION_ERROR", `Impossible de modifier le temps pour une commande en statut ${order.status}`);
    }

    const body = await req.json();
    const { prepMinutes } = prepTimeSchema.parse(body);

    const estimatedReady = new Date(Date.now() + prepMinutes * 60_000);

    const updated = await prisma.order.update({
      where: { id },
      data: { estimatedReady },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "orders/prep-time PATCH");
  }
}
