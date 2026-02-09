import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── POST /api/orders/[id]/ready ────────────────
// Boucher (owner) — mark order as ready for pickup
export async function POST(
  _req: NextRequest,
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
      select: { status: true, shop: { select: { ownerId: true } } },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }
    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError("VALIDATION_ERROR", `Impossible de marquer prêt une commande en statut ${order.status}`);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "READY",
        actualReady: new Date(),
      },
    });

    // TODO: déclencher notification client

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
