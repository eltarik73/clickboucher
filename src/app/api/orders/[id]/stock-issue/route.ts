export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    // 1. Load order with items + product category info
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { categories: true } } } },
        shop: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shopId !== shopId) {
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

    // 3. Auto-toggle product stock to false (scoped by shopId)
    await prisma.product.updateMany({
      where: { id: { in: unavailableItems }, shopId },
      data: { inStock: false },
    });

    // 4. Find alternatives for each unavailable item (same category, same shop, in stock)
    const unavailableOrderItems = order.items.filter((item) =>
      unavailableItems.includes(item.productId)
    );

    const alternatives: Record<string, { id: string; name: string; priceCents: number; unit: string }[]> = {};

    // Single query for all alternatives (instead of N per unavailable item)
    const allCatIds = unavailableOrderItems.flatMap(item =>
      item.product.categories.map((c: { id: string }) => c.id)
    );
    const allAlts = allCatIds.length > 0
      ? await prisma.product.findMany({
          where: {
            shopId: order.shop.id,
            categories: { some: { id: { in: allCatIds } } },
            inStock: true,
            id: { notIn: unavailableItems },
          },
          select: { id: true, name: true, priceCents: true, unit: true, categories: { select: { id: true } } },
          orderBy: { priceCents: "asc" },
        })
      : [];

    for (const item of unavailableOrderItems) {
      const itemCatIds = new Set(item.product.categories.map((c: { id: string }) => c.id));
      alternatives[item.productId] = allAlts
        .filter(alt => alt.categories.some(c => itemCatIds.has(c.id)))
        .slice(0, 3)
        .map(({ id, name, priceCents, unit }) => ({ id, name, priceCents, unit }));
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
