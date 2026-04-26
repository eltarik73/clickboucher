export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

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
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-prep-time:${shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        shopId: true,
      },
    });

    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.shopId !== shopId) {
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
