import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { z } from "zod";

const stockIssueSchema = z.object({
  unavailableItems: z
    .array(z.string().min(1))
    .min(1, "Au moins un produit en rupture requis"),
});

// ── POST /api/orders/[id]/stock-issue ──────────
// Boucher (owner) — mark items as unavailable + auto-toggle product stock + find alternatives
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

    // 1. Load order with items + product category info
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { category: true } } } },
        shop: { select: { id: true, ownerId: true, name: true } },
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

    // 4. Find alternatives for each unavailable item (same category, same shop, in stock)
    const unavailableOrderItems = order.items.filter((item) =>
      unavailableItems.includes(item.productId)
    );

    const alternatives: Record<string, { id: string; name: string; priceCents: number; unit: string }[]> = {};

    for (const item of unavailableOrderItems) {
      const categoryId = item.product.categoryId;
      const alts = await prisma.product.findMany({
        where: {
          shopId: order.shop.id,
          categoryId,
          inStock: true,
          id: { notIn: unavailableItems },
        },
        select: {
          id: true,
          name: true,
          priceCents: true,
          unit: true,
        },
        take: 3,
        orderBy: { priceCents: "asc" },
      });
      alternatives[item.productId] = alts;
    }

    // 5. Recalculate totalCents (available items only)
    const availableItems = order.items.filter(
      (item) => !unavailableItems.includes(item.productId)
    );
    const newTotal = availableItems.reduce((sum, item) => sum + item.totalCents, 0);

    // 6. Determine status
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

    // Notify client
    await sendNotification("STOCK_ISSUE", {
      userId: order.userId,
      orderId: id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    });

    return apiSuccess({
      order: updated,
      alternatives,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
