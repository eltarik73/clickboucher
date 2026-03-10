import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { reorderProductsSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── PATCH /api/products/reorder ────────────────
// Boucher (owner) or Admin — reorder products
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const { shopId, productIds } = reorderProductsSchema.parse(body);

    // Verify ownership or admin
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
    if (!isAdmin(dbUser?.role)) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { ownerId: true },
      });
      if (!shop) {
        return apiError("NOT_FOUND", "Boucherie introuvable");
      }
      if (shop.ownerId !== userId && shop.ownerId !== dbUser?.id) {
        return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
      }
    }

    // Update displayOrder for each product (scoped by shopId)
    await prisma.$transaction(
      productIds.map((id, index) =>
        prisma.product.update({
          where: { id, shopId },
          data: { displayOrder: index },
        })
      )
    );

    return apiSuccess({ reordered: productIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}
