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

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      include: {
        categories: { orderBy: { order: "asc" } },
        _count: { select: { products: true, orders: true } },
      },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Aucune boucherie associee a ce compte");
    }

    return apiSuccess(shop);
  } catch (error) {
    return handleApiError(error);
  }
}
