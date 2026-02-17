// src/app/api/orders/[id]/respond/route.ts — Client responds to modifications (PARTIALLY_DENIED)
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { respondModificationSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function PATCH(
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
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }
    if (order.status !== "PARTIALLY_DENIED") {
      return apiError("VALIDATION_ERROR", `Action impossible (statut: ${order.status})`);
    }

    const body = await req.json();
    const { action } = respondModificationSchema.parse(body);

    if (action === "cancel_order") {
      const updated = await prisma.order.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { items: true },
      });
      return apiSuccess(updated);
    }

    // accept_changes — remove unavailable items, recalculate, go back to PENDING
    const availableItems = order.items.filter((item) => item.available);
    if (availableItems.length === 0) {
      return apiError("VALIDATION_ERROR", "Aucun article disponible");
    }

    const newTotal = availableItems.reduce((sum, item) => sum + item.totalCents, 0);

    await prisma.orderItem.deleteMany({
      where: { orderId: id, available: false },
    });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "PENDING",
        totalCents: newTotal,
        denyReason: null,
      },
      include: { items: { include: { product: true } } },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "orders/respond");
  }
}
