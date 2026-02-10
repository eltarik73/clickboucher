import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── GET /api/orders/[id]/alternatives?products=id1,id2 ──
// Client — get alternative products for unavailable items
export async function GET(
  req: NextRequest,
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
      include: {
        items: { include: { product: { select: { categoryId: true } } } },
        user: { select: { clerkId: true } },
        shop: { select: { id: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }

    const productIdsParam = req.nextUrl.searchParams.get("products") || "";
    const productIds = productIdsParam.split(",").filter(Boolean);

    if (productIds.length === 0) {
      return apiSuccess({});
    }

    // Find alternatives for each product
    const unavailableItems = order.items.filter(
      (i) => productIds.includes(i.productId) && !i.available
    );

    const alternatives: Record<string, { id: string; name: string; priceCents: number; unit: string }[]> = {};

    for (const item of unavailableItems) {
      const categoryId = item.product.categoryId;
      const alts = await prisma.product.findMany({
        where: {
          shopId: order.shop.id,
          categoryId,
          inStock: true,
          id: { notIn: productIds },
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

    return apiSuccess(alternatives);
  } catch (error) {
    return handleApiError(error);
  }
}
