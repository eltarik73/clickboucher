import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const modifyOrderSchema = z.object({
  action: z.enum(["continue", "cancel"]),
});

// ── POST /api/orders/[id]/modify ─────────────
// Client — after partial deny, choose to continue or cancel
export async function POST(
  req: NextRequest,
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
      include: {
        items: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Only the order owner can modify
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }

    if (order.status !== "PARTIALLY_DENIED") {
      return apiError(
        "VALIDATION_ERROR",
        `Impossible de modifier une commande en statut ${order.status}`
      );
    }

    const body = await req.json();
    const { action } = modifyOrderSchema.parse(body);

    if (action === "cancel") {
      const updated = await prisma.order.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { items: { include: { product: true } } },
      });
      return apiSuccess(updated);
    }

    // action === "continue"
    // Recalculate total with available items only
    const availableItems = order.items.filter((item) => item.available);

    if (availableItems.length === 0) {
      return apiError("VALIDATION_ERROR", "Aucun article disponible pour continuer");
    }

    const newTotal = availableItems.reduce((sum, item) => sum + item.totalCents, 0);

    // Delete unavailable items from the order
    await prisma.orderItem.deleteMany({
      where: {
        orderId: id,
        available: false,
      },
    });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "PENDING",
        totalCents: newTotal,
        denyReason: null,
      },
      include: {
        items: { include: { product: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
