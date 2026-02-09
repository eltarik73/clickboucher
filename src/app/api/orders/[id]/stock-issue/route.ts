import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const stockIssueSchema = z.object({
  unavailableItems: z
    .array(z.string().min(1))
    .min(1, "Au moins un produit en rupture requis"),
});

// ── POST /api/orders/[id]/stock-issue ──────────
// Boucher (owner) — mark items as unavailable + auto-toggle product stock
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // 1. Load order with items
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shop: { select: { ownerId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas a votre boucherie");
    }
    if (order.status !== "PENDING") {
      return apiError(
        "VALIDATION_ERROR",
        `Impossible de signaler une rupture sur une commande en statut ${order.status}`
      );
    }

    const body = await req.json();
    const { unavailableItems } = stockIssueSchema.parse(body);

    // 2. Mark unavailable OrderItems
    await prisma.orderItem.updateMany({
      where: {
        orderId: id,
        productId: { in: unavailableItems },
      },
      data: { available: false },
    });

    // 3. Auto-toggle product stock to false
    await prisma.product.updateMany({
      where: { id: { in: unavailableItems } },
      data: { inStock: false },
    });

    // 4. Recalculate totalCents (available items only)
    const availableItems = order.items.filter(
      (item) => !unavailableItems.includes(item.productId)
    );
    const newTotal = availableItems.reduce((sum, item) => sum + item.totalCents, 0);

    // 5. Determine status
    const allUnavailable = order.items.every((item) =>
      unavailableItems.includes(item.productId)
    );

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: allUnavailable ? "DENIED" : "PARTIALLY_DENIED",
        totalCents: allUnavailable ? 0 : newTotal,
        denyReason: allUnavailable
          ? "Tous les articles sont en rupture de stock"
          : "Certains articles sont en rupture de stock",
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
