import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// ── GET /api/shops/my-shop ───────────────
// Returns the shop owned by the authenticated boucher
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    console.log("[my-shop] Looking for shop with ownerId:", userId);

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      include: {
        categories: { orderBy: { order: "asc" } },
        _count: { select: { products: true, orders: true } },
      },
    });

    if (!shop) {
      console.log("[my-shop] No shop found for ownerId:", userId);
      return apiError("NOT_FOUND", "Aucune boucherie associee a ce compte");
    }

    console.log("[my-shop] Found shop:", shop.name, shop.id);

    return apiSuccess(shop);
  } catch (error) {
    return handleApiError(error);
  }
}
