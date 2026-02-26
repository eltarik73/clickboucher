import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";

export const dynamic = "force-dynamic";

// ── GET /api/shops/my-shop ───────────────
// Returns the shop owned by the authenticated boucher
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shop = await prisma.shop.findFirst({
      where: { id: shopId },
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
