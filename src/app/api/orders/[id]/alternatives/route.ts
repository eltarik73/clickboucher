import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/orders/[id]/alternatives?products=id1,id2 ──
// Client — get alternative products for unavailable items
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { categories: { select: { id: true } } } } } },
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

    // Single query for all alternatives (instead of N per unavailable item)
    const allCatIds = unavailableItems.flatMap(item =>
      item.product.categories.map((c: { id: string }) => c.id)
    );
    const allAlts = allCatIds.length > 0
      ? await prisma.product.findMany({
          where: {
            shopId: order.shop.id,
            categories: { some: { id: { in: allCatIds } } },
            inStock: true,
            id: { notIn: productIds },
          },
          select: { id: true, name: true, priceCents: true, unit: true, categories: { select: { id: true } } },
          orderBy: { priceCents: "asc" },
        })
      : [];

    const alternatives: Record<string, { id: string; name: string; priceCents: number; unit: string }[]> = {};
    for (const item of unavailableItems) {
      const itemCatIds = new Set(item.product.categories.map((c: { id: string }) => c.id));
      alternatives[item.productId] = allAlts
        .filter(alt => alt.categories.some(c => itemCatIds.has(c.id)))
        .slice(0, 3)
        .map(({ id, name, priceCents, unit }) => ({ id, name, priceCents, unit }));
    }

    return apiSuccess(alternatives);
  } catch (error) {
    return handleApiError(error);
  }
}
