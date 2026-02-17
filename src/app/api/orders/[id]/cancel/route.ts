import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isCancellable } from "@/lib/order-state-machine";

// ── POST /api/orders/[id]/cancel ───────────────
// Client (order owner) — cancel a pending order or ACCEPTED within 5 min
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
      select: {
        status: true,
        createdAt: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }

    if (!isCancellable(order.status, order.createdAt)) {
      if (order.status === "ACCEPTED") {
        return apiError("VALIDATION_ERROR", "Le délai d'annulation de 5 minutes est dépassé");
      }
      return apiError("VALIDATION_ERROR", "Seules les commandes en attente peuvent être annulées");
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
